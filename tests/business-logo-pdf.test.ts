import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import sharp from "sharp";
import { renderInvoicePdfBase64, type InvoicePdfInput } from "../lib/business-invoice-pdf";

function invoice(customerLogoBytes?: Uint8Array | null): InvoicePdfInput {
  return {
    invoiceNumber: "NL0042",
    createdAt: new Date("2026-09-05T08:00:00.000Z"),
    companyName: "Voorbeeld Horeca B.V.",
    contactName: "Zakelijke Klant",
    email: "klant@example.nl",
    kvkNumber: "12345678",
    vatNumber: "NL123456789B01",
    country: "NL",
    items: [{ productName: "Cashewnoten", variantLabel: "1 kg", quantity: 2, unitPriceCents: 1500 }],
    subtotalCents: 3000,
    vatRatePercent: 9,
    vatAmountCents: 270,
    totalCents: 3270,
    vatNote: null,
    customerLogoBytes,
  };
}

function embeddedImageCount(document: PDFDocument): number {
  let count = 0;
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) count += 1;
  }
  return count;
}

test("embeds a snapshot of the customer logo into a newly generated invoice", async () => {
  const logo = await sharp({ create: { width: 400, height: 160, channels: 4, background: "#164e63" } }).webp().toBuffer();
  const withoutLogo = await PDFDocument.load(Buffer.from(await renderInvoicePdfBase64(invoice()), "base64"));
  const withLogo = await PDFDocument.load(Buffer.from(await renderInvoicePdfBase64(invoice(logo)), "base64"));
  assert.equal(embeddedImageCount(withLogo), embeddedImageCount(withoutLogo) + 1);
});

test("invalid or unavailable customer logo bytes never block invoice creation", async (context) => {
  const loggedErrors: unknown[][] = [];
  context.mock.method(console, "error", (...args: unknown[]) => {
    loggedErrors.push(args);
  });
  const base64 = await renderInvoicePdfBase64(invoice(Buffer.from("corrupt-logo")));
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.toString("ascii", 0, 5), "%PDF-");
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
  assert.equal(loggedErrors.length, 1);
});
