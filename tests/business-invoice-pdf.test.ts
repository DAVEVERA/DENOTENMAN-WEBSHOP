import assert from "node:assert/strict";
import test from "node:test";
import { renderInvoicePdfBase64, invoiceRecipientLines } from "../lib/business-invoice-pdf";

function sampleInvoice(overrides: Partial<Parameters<typeof renderInvoicePdfBase64>[0]> = {}) {
  return {
    invoiceNumber: "F2026-000123",
    createdAt: new Date("2026-09-02T10:00:00.000Z"),
    companyName: "Kaashandel Forment",
    contactName: "Tim Forment",
    email: "fedor@denotenman.com",
    kvkNumber: "12345678",
    vatNumber: "NL123456789B01",
    country: "NL",
    billingStreet: "Marktstraat",
    billingHouseNumber: "24",
    billingPostalCode: "5211 JV",
    billingCity: "'s-Hertogenbosch",
    billingCountry: "NL",
    items: [
      { productName: "Cashewnoten", variantLabel: "kg", quantity: 2, unitPriceCents: 2500 },
    ],
    subtotalCents: 5000,
    vatRatePercent: 9,
    vatAmountCents: 450,
    totalCents: 5450,
    paidCents: 5450,
    vatNote: null,
    ...overrides,
  };
}

test("builds the optional invoice contact and address lines from available data", () => {
  const lines = invoiceRecipientLines(sampleInvoice());
  assert.deepEqual(lines, [
    "Kaashandel Forment",
    "t.a.v. Tim Forment",
    "Marktstraat 24",
    "5211 JV 's-Hertogenbosch",
    "Nederland",
    "fedor@denotenman.com",
    "KVK 12345678",
    "BTW NL123456789B01",
  ]);
});

test("omits unavailable optional contact and registration fields", () => {
  const lines = invoiceRecipientLines(sampleInvoice({
    contactName: null,
    kvkNumber: null,
    vatNumber: null,
    billingStreet: null,
    billingHouseNumber: null,
    billingPostalCode: null,
    billingCity: null,
    billingCountry: "BE",
    country: "BE",
  }));
  assert.deepEqual(lines, ["Kaashandel Forment", "België", "fedor@denotenman.com"]);
});

test(
  "renderInvoicePdfBase64 still returns a base64 PDF via the HTML/Playwright pipeline",
  { skip: "requires a Chromium binary not installed in this sandbox" },
  async () => {
    const base64 = await renderInvoicePdfBase64(sampleInvoice());
    assert.equal(typeof base64, "string");
    assert.ok(base64.length > 0);
    const bytes = Buffer.from(base64, "base64");
    assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
  }
);
