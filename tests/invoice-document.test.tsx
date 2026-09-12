import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "../components/invoice-pdf/InvoiceDocument";
import { deriveCanvasFromLegacyContent, INVOICE_TEMPLATE_BLOCK_KEYS, DEFAULT_INVOICE_TEMPLATE_BLOCKS, blockTextKey, type InvoiceTemplateBlockLayout, type InvoiceCanvas } from "../lib/invoice-template-schema";

function defaultCanvas(): { canvas: InvoiceCanvas; blockText: Record<string, string> } {
  const blocks: InvoiceTemplateBlockLayout[] = INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => ({ key, ...DEFAULT_INVOICE_TEMPLATE_BLOCKS[key], textOverrides: null }));
  return deriveCanvasFromLegacyContent(blocks);
}

const sampleInput = {
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

test("all required fiscal fields are present in the rendered markup", () => {
  const { canvas, blockText } = defaultCanvas();
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} canvas={canvas} blockText={blockText} />);
  assert.match(markup, /NL0099/);
  assert.match(markup, /12345678/);
  assert.match(markup, /NL123456789B01/);
  assert.match(markup, /Amandelen/);
  assert.match(markup, /Testbedrijf BV/);
});

test("a footer text override replaces the default thank-you line", () => {
  const { canvas, blockText } = defaultCanvas();
  blockText[blockTextKey("footer", "thankYouLine")] = "Bedankt voor je bestelling!";
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} canvas={canvas} blockText={blockText} />);
  assert.match(markup, /Bedankt voor je bestelling!/);
});

test("a canvas missing the totals and itemsTable blocks still renders both, via the safety fallback", () => {
  const { canvas, blockText } = defaultCanvas();
  const trimmed: InvoiceCanvas = { rows: canvas.rows.filter((row) => !row.id.startsWith("totals") && !row.id.startsWith("itemsTable")) };
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} canvas={trimmed} blockText={blockText} />);
  assert.match(markup, /Amandelen/);
  assert.match(markup, /7,63/);
});

test("the page has no fixed height, allowing content to flow across a printed page break", () => {
  const { canvas, blockText } = defaultCanvas();
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} canvas={canvas} blockText={blockText} />);
  assert.doesNotMatch(markup, /height:842pt/);
});
