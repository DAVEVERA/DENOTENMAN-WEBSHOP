import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "../components/invoice-pdf/InvoiceDocument";
import { DEFAULT_INVOICE_TEMPLATE_BLOCKS, INVOICE_TEMPLATE_BLOCK_KEYS, type InvoiceTemplateBlockLayout } from "../lib/invoice-template-schema";

function defaultBlocks(): InvoiceTemplateBlockLayout[] {
  return INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => ({ key, ...DEFAULT_INVOICE_TEMPLATE_BLOCKS[key], textOverrides: null }));
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

test("every block's absolute position/size is reflected as inline style", () => {
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} blocks={defaultBlocks()} />);
  const header = DEFAULT_INVOICE_TEMPLATE_BLOCKS.header;
  assert.match(markup, new RegExp(`left:${header.x}pt`));
  assert.match(markup, new RegExp(`top:${header.y}pt`));
});

test("all required fiscal fields are present in the rendered markup", () => {
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} blocks={defaultBlocks()} />);
  assert.match(markup, /NL0099/);
  assert.match(markup, /12345678/);
  assert.match(markup, /NL123456789B01/);
  assert.match(markup, /Amandelen/);
  assert.match(markup, /Testbedrijf BV/);
});

test("a footer text override replaces the default thank-you line", () => {
  const blocks = defaultBlocks().map((block) =>
    block.key === "footer" ? { ...block, textOverrides: { thankYouLine: "Bedankt voor je bestelling!" } } : block
  );
  const markup = renderToStaticMarkup(<InvoiceDocument input={sampleInput} blocks={blocks} />);
  assert.match(markup, /Bedankt voor je bestelling!/);
});
