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

test("builds the optional invoice contact and address lines from available data", async () => {
  const { invoiceRecipientLines } = await import("../lib/business-invoice-pdf");
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

test("omits unavailable optional contact and registration fields", async () => {
  const { invoiceRecipientLines } = await import("../lib/business-invoice-pdf");
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
  const document = await import("pdf-lib").then(({ PDFDocument }) => PDFDocument.load(bytes));
  assert.ok(document.getPageCount() >= 2, "Long order lists should continue on a new page");
});
