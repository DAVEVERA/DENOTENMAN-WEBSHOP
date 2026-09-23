import "server-only";

import { BASE_URL } from "@/lib/routes";
import {
  BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS,
  createBusinessInvoiceDownloadUrl as createDownloadUrl,
  isValidBusinessInvoiceDownloadLink as validateDownloadLink,
} from "@/lib/business-invoice-download-contract";

// A mail client does not carry the business-portal cookie. This bearer link is
// consequently limited to one order and expires after a reasonable retrieval
// period; the normal portal route remains available after that period.
function signingSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return secret;
}

export function createBusinessInvoiceDownloadUrl(orderId: string, now = Date.now()): string {
  return createDownloadUrl({ baseUrl: BASE_URL, secret: signingSecret(), orderId, now });
}

export function isValidBusinessInvoiceDownloadLink(
  orderId: string,
  expires: string | null,
  receivedSignature: string | null,
  now = Date.now()
): boolean {
  return validateDownloadLink({ secret: signingSecret(), orderId, expires, receivedSignature, now });
}

export { BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS };
