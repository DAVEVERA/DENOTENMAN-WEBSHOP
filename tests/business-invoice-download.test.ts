import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS,
  createBusinessInvoiceDownloadUrl,
  isValidBusinessInvoiceDownloadLink,
} from "../lib/business-invoice-download-contract";

const secret = "business-invoice-download-test-secret-with-sufficient-length";

test("a business invoice email link is bound to one order and has a finite lifetime", () => {
  const now = 1_790_000_000_000;
  const url = new URL(createBusinessInvoiceDownloadUrl({ baseUrl: "https://www.denotenman.nl", secret, orderId: "order_123", now }));
  const expires = url.searchParams.get("expires");
  const signature = url.searchParams.get("signature");

  assert.equal(url.pathname, "/api/business/orders/order_123/invoice");
  assert.equal(Number(expires), now + BUSINESS_INVOICE_DOWNLOAD_TTL_SECONDS * 1000);
  assert.equal(isValidBusinessInvoiceDownloadLink({ secret, orderId: "order_123", expires, receivedSignature: signature, now }), true);
  assert.equal(isValidBusinessInvoiceDownloadLink({ secret, orderId: "another_order", expires, receivedSignature: signature, now }), false);
  assert.equal(isValidBusinessInvoiceDownloadLink({ secret, orderId: "order_123", expires, receivedSignature: `${signature}x`, now }), false);
  assert.equal(isValidBusinessInvoiceDownloadLink({ secret, orderId: "order_123", expires, receivedSignature: signature, now: Number(expires) }), false);
});
