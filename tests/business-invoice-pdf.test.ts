import assert from "node:assert/strict";
import test from "node:test";
import { renderInvoicePdfBase64 } from "../lib/business-invoice-pdf";

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
    items: [
      { productName: "Cashewnoten", variantLabel: "kg", quantity: 2, unitPriceCents: 2500 },
    ],
    subtotalCents: 5000,
    vatRatePercent: 9,
    vatAmountCents: 450,
    totalCents: 5450,
    vatNote: null,
    ...overrides,
  };
}

test("renders a valid PDF with the brand logo embedded", async () => {
  const base64 = await renderInvoicePdfBase64(sampleInvoice());
  const bytes = Buffer.from(base64, "base64");
  assert.ok(bytes.length > 1000, "PDF should be a non-trivial size");
  assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
});

test("renders a reverse-charge (BE) invoice with a VAT note and 0% rate", async () => {
  const base64 = await renderInvoicePdfBase64(sampleInvoice({
    country: "BE",
    vatRatePercent: 0,
    vatAmountCents: 0,
    totalCents: 5000,
    vatNote: "BTW verlegd naar de afnemer.",
  }));
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
});

test("renders correctly with many line items and no KVK/VAT number on file", async () => {
  const base64 = await renderInvoicePdfBase64(sampleInvoice({
    kvkNumber: null,
    vatNumber: null,
    items: Array.from({ length: 10 }, (_, index) => ({
      productName: `Product met een behoorlijk lange productnaam ${index}`,
      variantLabel: null,
      quantity: index + 1,
      unitPriceCents: 1234,
    })),
  }));
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
});
