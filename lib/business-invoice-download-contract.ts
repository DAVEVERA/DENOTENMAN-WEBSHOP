import { createHmac, timingSafeEqual } from "node:crypto";

export const BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 90;

function payload(orderId: string, expiresAt: number): string {
  return `business-invoice-download:${orderId}:${expiresAt}`;
}

function signature(secret: string, orderId: string, expiresAt: number): string {
  return createHmac("sha256", secret)
    .update(payload(orderId, expiresAt), "utf8")
    .digest("base64url");
}

export function createBusinessInvoiceDownloadUrl(input: {
  baseUrl: string;
  secret: string;
  orderId: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  const expiresAt = now + BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS * 1000;
  const url = new URL(`/api/business/orders/${encodeURIComponent(input.orderId)}/invoice`, input.baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature(input.secret, input.orderId, expiresAt));
  return url.toString();
}

export function isValidBusinessInvoiceDownloadLink(input: {
  secret: string;
  orderId: string;
  expires: string | null;
  receivedSignature: string | null;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (!input.expires || !input.receivedSignature || !/^\d{13}$/.test(input.expires) || !/^[A-Za-z0-9_-]{43}$/.test(input.receivedSignature)) {
    return false;
  }

  const expiresAt = Number(input.expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const expected = Buffer.from(signature(input.secret, input.orderId, expiresAt), "utf8");
  const received = Buffer.from(input.receivedSignature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
