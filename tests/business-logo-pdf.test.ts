import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { renderInvoicePdfBase64, type InvoicePdfInput } from "../lib/business-invoice-pdf";

function invoice(): InvoicePdfInput {
  return {
    invoiceNumber: "NL0042",
    createdAt: new Date("2026-09-05T08:00:00.000Z"),
    companyName: "Voorbeeld Horeca B.V.",
    contactName: "Zakelijke Klant",
    email: "klant@example.nl",
    kvkNumber: "12345678",
    vatNumber: "NL123456789B01",
    country: "NL",
    billingStreet: "Marktstraat",
    billingHouseNumber: "24",
    billingPostalCode: "5211 JV",
    billingCity: "'s-Hertogenbosch",
    billingCountry: "NL",
    items: [{ productName: "Cashewnoten", variantLabel: "1 kg", quantity: 2, unitPriceCents: 1500 }],
    subtotalCents: 3000,
    vatRatePercent: 9,
    vatAmountCents: 270,
    totalCents: 3270,
    paidCents: 3270,
    vatNote: null,
  };
}

function embeddedImageCount(document: PDFDocument): number {
  let count = 0;
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) {
      count += 1;
    }
  }
  return count;
}

test(
  "embeds only the centered De Notenman brand logo",
  { skip: "requires a Chromium binary not installed in this sandbox" },
  async () => {
    const baselineDocument = await PDFDocument.load(
      Buffer.from(await renderInvoicePdfBase64(invoice()), "base64")
    );
    const inputWithLegacyCustomerLogo = {
      ...invoice(),
      customerLogoBytes: Buffer.from("legacy-customer-logo-must-be-ignored"),
    } as InvoicePdfInput;

    const document = await PDFDocument.load(
      Buffer.from(await renderInvoicePdfBase64(inputWithLegacyCustomerLogo), "base64")
    );

    assert.ok(embeddedImageCount(baselineDocument) > 0, "The De Notenman wordmark should be embedded");
    assert.equal(embeddedImageCount(document), embeddedImageCount(baselineDocument));
  }
);
