import type { Order } from "@prisma/client";
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
  ]);

  const customerCode = settings["postnl.customerCode"];
  const customerNumber = settings["postnl.customerNumber"];
  const collectionLocation = settings["postnl.collectionLocation"];

  if (!customerCode || !customerNumber || !collectionLocation) {
    throw new PostnlError(
      "PostNL-accountgegevens ontbreken. Vul CustomerCode, CustomerNumber en CollectionLocation in bij Instellingen."
    );
  }

  return { customerCode, customerNumber, collectionLocation };
}

async function generateBarcode(customerCode: string, customerNumber: string): Promise<string> {
  const params = new URLSearchParams({
    CustomerCode: customerCode,
    CustomerNumber: customerNumber,
    Type: "3S",
    Serie: "000000000-999999999",
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
  order: Order
): Promise<{ barcode: string; labelBase64: string }> {
  const { customerCode, customerNumber, collectionLocation } = await getAccountSettings();
  const barcode = await generateBarcode(customerCode, customerNumber);

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
        ],
        Barcode: barcode,
        Dimension: { Weight: "1000" },
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
