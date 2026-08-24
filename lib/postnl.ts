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

const DEFAULT_PRODUCT_CODES: Record<string, string> = {
  NL: "3085",
  BE: "4946",
};

export const POSTNL_REQUEST_TIMEOUTS = Object.freeze({
  barcodeMs: 10_000,
  labelMs: 25_000,
});

export class PostnlError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "PostnlError";
    this.details = details;
  }
}

export function resolvePostnlProductCode(countryCode: string): string {
  const country = countryCode.trim().toUpperCase();
  const countryOverride = process.env[`POSTNL_PRODUCT_CODE_${country}`];
  const productCode =
    countryOverride ?? process.env.POSTNL_PRODUCT_CODE ?? DEFAULT_PRODUCT_CODES[country];

  if (!productCode) {
    throw new PostnlError(`Geen PostNL-productcode geconfigureerd voor land ${country || "onbekend"}.`);
  }

  return productCode;
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

async function postnlFetch(
  url: string,
  init: RequestInit,
  operation: string,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new PostnlError(
        `${operation} duurde langer dan ${Math.round(timeoutMs / 1_000)} seconden en is afgebroken.`
      );
    }

    throw new PostnlError(`${operation} kon PostNL niet bereiken.`, {
      cause: error instanceof Error ? error.message : "Onbekende netwerkfout",
    });
  }
}

export async function generateBarcode(
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

  const response = await postnlFetch(
    `${BASE_URL}/shipment/v1_1/barcode?${params.toString()}`,
    { headers: { apikey: apiKey(), Accept: "application/json" } },
    "De PostNL-barcodeaanvraag",
    POSTNL_REQUEST_TIMEOUTS.barcodeMs
  );

  const body = await response.json().catch(() => null);
  const barcode = body?.Barcode;

  if (!response.ok || typeof barcode !== "string") {
    throw new PostnlError(`PostNL barcode-aanvraag mislukt (status ${response.status}).`, body);
  }

  return barcode;
}

export async function createShipmentBarcode(): Promise<string> {
  const { customerCode, customerNumber, barcodeSerie } = await getAccountSettings();
  return generateBarcode(customerCode, customerNumber, barcodeSerie);
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function splitPostnlHouseNumber(value: string): { houseNumber: string; extension?: string } {
  const normalized = value.trim().replace(/\s+/g, " ");
  const match = /^(\d+)\s*(.*)$/.exec(normalized);
  if (!match) throw new PostnlError(`Ongeldig huisnummer voor PostNL: ${value}`);
  const extension = match[2]?.trim();
  if (extension && extension.length > 35) throw new PostnlError("De huisnummertoevoeging is te lang voor PostNL.");
  return { houseNumber: match[1], extension: extension || undefined };
}

export async function createShipmentLabel(
  order: ShipmentOrder,
  existingBarcode?: string
): Promise<{ barcode: string; labelBase64: string }> {
  const { customerCode, customerNumber, collectionLocation, barcodeSerie } =
    await getAccountSettings();
  const sender = await getSenderAddress();
  const barcode =
    existingBarcode ??
    (await generateBarcode(customerCode, customerNumber, barcodeSerie));
  const weightGrams = calculateShipmentWeightGrams(order.items);
  const recipientHouse = splitPostnlHouseNumber(order.shippingHouseNumber);
  const senderHouse = splitPostnlHouseNumber(sender.senderHouseNumber);

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
            HouseNr: recipientHouse.houseNumber,
            ...(recipientHouse.extension ? { HouseNrExt: recipientHouse.extension } : {}),
            Street: order.shippingStreet,
            Zipcode: order.shippingPostalCode.replace(/\s+/g, ""),
            Name: order.contactName,
          },
          {
            AddressType: "02",
            City: sender.senderCity,
            Countrycode: sender.senderCountry,
            HouseNr: senderHouse.houseNumber,
            ...(senderHouse.extension ? { HouseNrExt: senderHouse.extension } : {}),
            Street: sender.senderStreet,
            Zipcode: sender.senderPostalCode.replace(/\s+/g, ""),
            Name: sender.senderName,
          },
        ],
        Barcode: barcode,
        Dimension: { Weight: String(weightGrams) },
        ProductCodeDelivery: resolvePostnlProductCode(order.shippingCountry),
      },
    ],
  };

  const response = await postnlFetch(
    `${BASE_URL}/shipment/v2_2/label`,
    {
      method: "POST",
      headers: {
        apikey: apiKey(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    "De PostNL-labelaanvraag",
    POSTNL_REQUEST_TIMEOUTS.labelMs
  );

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
