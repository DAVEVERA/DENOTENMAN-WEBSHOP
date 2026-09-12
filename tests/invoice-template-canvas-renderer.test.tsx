import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderDataBlock } from "../lib/invoice-template-canvas-renderer";
import { blockTextKey, type InvoiceDataBlock } from "../lib/invoice-template-schema";
import type { InvoicePdfInput } from "../lib/business-invoice-pdf";

const sampleInput: InvoicePdfInput = {
  invoiceNumber: "NL0099",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  companyName: "Testbedrijf BV",
  contactName: "Dave Vera",
  email: "dave@testbedrijf.nl",
  kvkNumber: "12345678",
  vatNumber: "NL123456789B01",
  country: "NL",
  billingStreet: "Teststraat",
  billingHouseNumber: "1",
  billingPostalCode: "1234AB",
  billingCity: "Teststad",
  billingCountry: "NL",
  items: [{ productName: "Amandelen", variantLabel: "250 gram", quantity: 2, unitPriceCents: 350 }],
  subtotalCents: 700,
  vatRatePercent: 9,
  vatAmountCents: 63,
  totalCents: 763,
  paidCents: 763,
  vatNote: null,
};

function dataBlock(type: InvoiceDataBlock["type"]): InvoiceDataBlock {
  return { id: type, type, backgroundColor: "#ffffff", textColor: "#333333" };
}

test("itemsTable renders every order line and its price", () => {
  const markup = renderToStaticMarkup(renderDataBlock(dataBlock("itemsTable"), sampleInput, {}, null));
  assert.match(markup, /Amandelen/);
  assert.match(markup, /250 gram/);
});

test("totals renders the invoice's VAT and total amounts", () => {
  const markup = renderToStaticMarkup(renderDataBlock(dataBlock("totals"), sampleInput, {}, null));
  assert.match(markup, /BTW \(9%\)/);
  assert.match(markup, /7,63/);
});

test("a footer text override in blockText replaces the default thank-you line", () => {
  const markup = renderToStaticMarkup(
    renderDataBlock(dataBlock("footer"), sampleInput, { [blockTextKey("footer", "thankYouLine")]: "Bedankt voor je bestelling!" }, null)
  );
  assert.match(markup, /Bedankt voor je bestelling!/);
});

test("block textColor/backgroundColor settings are reflected as inline style", () => {
  const block: InvoiceDataBlock = { id: "header", type: "header", backgroundColor: "#111111", textColor: "#eeeeee" };
  const markup = renderToStaticMarkup(renderDataBlock(block, sampleInput, {}, null));
  assert.match(markup, /background:#111111/);
  assert.match(markup, /color:#eeeeee/);
});
