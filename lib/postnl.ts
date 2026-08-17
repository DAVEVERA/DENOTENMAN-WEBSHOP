import type { Order, OrderStatus } from "@prisma/client";
import { getSettings } from "@/lib/settings";

// NOTE: built from PostNL's public developer docs and third-party client
// references, not a live-tested account — the exact request/response shape
// could not be fully verified against real PostNL sandbox/production output.
// PostnlError always carries the raw API response body so a failure here is
// diagnosable (and fixable) from the admin UI instead of failing silently.

const BASE_URL =
  process.env.POSTNL_SANDBOX === "true"
    ? "https://api-sandbox.postnl.nl"
    : "https://api.postnl.nl";

// "PostNL Pakket" standard NL parcel delivery. Override via the
// POSTNL_PRODUCT_CODE env var if this account uses a different product.
const DEFAULT_PRODUCT_CODE = process.env.POSTNL_PRODUCT_CODE ?? "3085";

export class PostnlError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "PostnlError";
    this.details = details;
  }
}

export type ShipmentWeightLine = {
  quantity: number;
  variant: { weightGrams: number };
};

export type ShipmentOrder = Order & {
  items: ShipmentWeightLine[];
  shippingStreet: string;
  shippingHouseNumber: string;
  shippingPostalCode: string;
  shippingCity: string;
};

export function calculateShipmentWeightGrams(items: ShipmentWeightLine[]): number {
  const weightGrams = items.reduce(
    (total, item) => total + item.quantity * item.variant.weightGrams,
    0
  );

  if (!Number.isSafeInteger(weightGrams) || weightGrams <= 0) {
    throw new PostnlError("Geen geldig verzendgewicht beschikbaar voor deze bestelling.");
  }

  return weightGrams;
}

export function determineLabelAction(
  status: OrderStatus,
  hasExistingLabel: boolean,
  isTest = false
): "create" | "reuse" | "reject" {
  if (isTest) {
    return "reject";
  }
  if (status !== "PAID" && status !== "FULFILLED") {
    return "reject";
  }

  return hasExistingLabel ? "reuse" : "create";
}

function apiKey(): string {
  const key = process.env.POSTNL_API_KEY;
  if (!key) {
    throw new PostnlError("POSTNL_API_KEY is niet geconfigureerd.");
  }
  return key;
}

async function getAccountSettings() {
  const settings = await getSettings([
    "postnl.customerCode",
    "postnl.customerNumber",
    "postnl.collectionLocation",
    "postnl.barcodeSerie",
  ]);

  const customerCode = settings["postnl.customerCode"];
  const customerNumber = settings["postnl.customerNumber"];
  const collectionLocation = settings["postnl.collectionLocation"];
  const barcodeSerie = settings["postnl.barcodeSerie"] ?? "00000000-99999999";

  if (!customerCode || !customerNumber || !collectionLocation) {
    throw new PostnlError(
      "PostNL-accountgegevens ontbreken. Vul CustomerCode, CustomerNumber en CollectionLocation in bij Instellingen."
    );
  }

  return { customerCode, customerNumber, collectionLocation, barcodeSerie };
}

async function getSenderAddress() {
  const settings = await getSettings([
    "postnl.senderName",
    "postnl.senderStreet",
    "postnl.senderHouseNumber",
    "postnl.senderPostalCode",
    "postnl.senderCity",
    "postnl.senderCountry",
  ]);

  const senderName = settings["postnl.senderName"];
  const senderStreet = settings["postnl.senderStreet"];
  const senderHouseNumber = settings["postnl.senderHouseNumber"];
  const senderPostalCode = settings["postnl.senderPostalCode"];
  const senderCity = settings["postnl.senderCity"];
  const senderCountry = settings["postnl.senderCountry"] ?? "NL";

  if (!senderName || !senderStreet || !senderHouseNumber || !senderPostalCode || !senderCity) {
    throw new PostnlError(
      "Afzenderadres ontbreekt. Vul de afzendergegevens (naam, straat, huisnummer, postcode, plaats) in bij Instellingen."
    );
  }

  return { senderName, senderStreet, senderHouseNumber, senderPostalCode, senderCity, senderCountry };
}

async function generateBarcode(
  customerCode: string,
  customerNumber: string,
  barcodeSerie: string
): Promise<string> {
  const params = new URLSearchParams({
    CustomerCode: customerCode,
    CustomerNumber: customerNumber,
    Type: "3S",
    Serie: barcodeSerie,
  });

  const response = await fetch(`${BASE_URL}/shipment/v1_1/barcode?${params.toString()}`, {
    headers: { apikey: apiKey(), Accept: "application/json" },
  });

  const body = await response.json().catch(() => null);
  const barcode = body?.Barcode;

  if (!response.ok || typeof barcode !== "string") {
    throw new PostnlError(`PostNL barcode-aanvraag mislukt (status ${response.status}).`, body);
  }

  return barcode;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function createShipmentLabel(
  order: ShipmentOrder
): Promise<{ barcode: string; labelBase64: string }> {
  const { customerCode, customerNumber, collectionLocation, barcodeSerie } =
    await getAccountSettings();
  const sender = await getSenderAddress();
  const barcode = await generateBarcode(customerCode, customerNumber, barcodeSerie);
  const weightGrams = calculateShipmentWeightGrams(order.items);

  const payload = {
    Customer: {
      CustomerCode: customerCode,
      CustomerNumber: customerNumber,
      CollectionLocation: collectionLocation,
    },
    Message: {
      MessageID: order.id.slice(0, 20),
      MessageTimeStamp: formatTimestamp(new Date()),
      Printertype: "GraphicFile|PDF",
    },
    Shipments: [
      {
        Addresses: [
          {
            AddressType: "01",
            City: order.shippingCity,
            Countrycode: order.shippingCountry,
            HouseNr: order.shippingHouseNumber,
            Street: order.shippingStreet,
            Zipcode: order.shippingPostalCode.replace(/\s+/g, ""),
            Name: order.contactName,
          },
          {
            AddressType: "02",
            City: sender.senderCity,
            Countrycode: sender.senderCountry,
            HouseNr: sender.senderHouseNumber,
            Street: sender.senderStreet,
            Zipcode: sender.senderPostalCode.replace(/\s+/g, ""),
            Name: sender.senderName,
          },
        ],
        Barcode: barcode,
        Dimension: { Weight: String(weightGrams) },
        ProductCodeDelivery: DEFAULT_PRODUCT_CODE,
      },
    ],
  };

  const response = await fetch(`${BASE_URL}/shipment/v2_2/label`, {
    method: "POST",
    headers: {
      apikey: apiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new PostnlError(`PostNL labelaanvraag mislukt (status ${response.status}).`, body);
  }

  const labelContent: unknown =
    body?.ResponseShipments?.[0]?.Labels?.[0]?.Content ?? body?.Labels?.[0]?.Content ?? null;

  if (typeof labelContent !== "string" || !labelContent) {
    throw new PostnlError(
      "PostNL gaf een geldig antwoord terug, maar zonder herkenbare labelinhoud — controleer de ruwe response.",
      body
    );
  }

  return { barcode, labelBase64: labelContent };
}
