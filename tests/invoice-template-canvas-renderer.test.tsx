import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderDataBlock, renderFreeBlock } from "../lib/invoice-template-canvas-renderer";
import { blockTextKey, type InvoiceDataBlock } from "../lib/invoice-template-schema";
import { LEGAL_IDENTITY } from "../lib/legal";
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

test("sellerAddress renders De Notenman's real address, KVK and BTW from lib/legal", () => {
  const markup = renderToStaticMarkup(renderDataBlock(dataBlock("sellerAddress"), sampleInput, {}, null));
  assert.match(markup, new RegExp(LEGAL_IDENTITY.tradeName));
  assert.match(markup, /Oude Baan 7a/);
  assert.match(markup, /5076 PJ Haaren/);
  assert.match(markup, new RegExp(`KVK ${LEGAL_IDENTITY.registrationNumber}`));
  assert.match(markup, new RegExp(`BTW ${LEGAL_IDENTITY.vatNumber}`));
});

test("footer renders De Notenman's KVK and BTW alongside the thank-you line", () => {
  const markup = renderToStaticMarkup(renderDataBlock(dataBlock("footer"), sampleInput, {}, null));
  assert.match(markup, /Bedankt voor uw bestelling bij De Notenman\./);
  assert.match(markup, new RegExp(`KVK ${LEGAL_IDENTITY.registrationNumber}`));
  assert.match(markup, new RegExp(`BTW ${LEGAL_IDENTITY.vatNumber}`));
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

test("a text block renders its blockText content with its style settings", () => {
  const block = { id: "note-1", type: "text" as const, font: "SERIF" as const, size: "GROOT" as const, color: "#222222", align: "center" as const, bold: true, italic: false };
  const markup = renderToStaticMarkup(renderFreeBlock(block, { [blockTextKey("note-1")]: "Bedankt voor uw vertrouwen." }));
  assert.match(markup, /Bedankt voor uw vertrouwen\./);
  assert.match(markup, /text-align:center/);
});

test("an image block with no mediaUrl renders nothing", () => {
  const block = { id: "img-1", type: "image" as const, mediaUrl: null, alt: "", widthPt: 100, align: "left" as const };
  const markup = renderToStaticMarkup(renderFreeBlock(block, {}));
  assert.equal(markup, "");
});

test("a customHtml block renders its blockText content unescaped", () => {
  const block = { id: "html-1", type: "customHtml" as const };
  const markup = renderToStaticMarkup(renderFreeBlock(block, { [blockTextKey("html-1")]: "<strong>Let op</strong>" }));
  assert.match(markup, /<strong>Let op<\/strong>/);
});
