import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PackingSlipDocument, type PackingSlipInput } from "../lib/packing-slip-pdf";

const sampleInput: PackingSlipInput = {
  orderId: "cktest1234567890",
  orderNumber: "DN-2026-00125",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  contactName: "Marije de Boer",
  shippingStreet: "Marktstraat",
  shippingHouseNumber: "24",
  shippingPostalCode: "5211 JV",
  shippingCity: "'s-Hertogenbosch",
  shippingCountry: "NL",
  items: [
    { productName: "Gebrande amandelen", variantLabel: "Ongezouten | 1 kg", quantity: 3 },
    { productName: "Pecannoten", variantLabel: "Ongebrand | 500 g", quantity: 2 },
  ],
};

test("the packing slip renders the shipping address and every item with its quantity", () => {
  const markup = renderToStaticMarkup(<PackingSlipDocument input={sampleInput} />);
  assert.match(markup, /Marije de Boer/);
  assert.match(markup, /Marktstraat 24/);
  assert.match(markup, /5211 JV.*Hertogenbosch/);
  assert.match(markup, /Gebrande amandelen/);
  assert.match(markup, /Pecannoten/);
});

test("the packing slip shows the correct total item count and no prices", () => {
  const markup = renderToStaticMarkup(<PackingSlipDocument input={sampleInput} />);
  assert.match(markup, /Totaal aantal artikelen/);
  assert.match(markup, />5</); // 3 + 2
  assert.doesNotMatch(markup, /€/);
});

test("the packing slip uses the customer-facing order number", () => {
  const markup = renderToStaticMarkup(<PackingSlipDocument input={sampleInput} />);
  assert.match(markup, /DN-2026-00125/);
  assert.doesNotMatch(markup, /cktest1234/);
});

test("the packing-slip date uses the Amsterdam calendar day", () => {
  const markup = renderToStaticMarkup(
    <PackingSlipDocument
      input={{ ...sampleInput, createdAt: new Date("2026-10-24T22:30:00.000Z") }}
    />
  );
  assert.match(markup, /25 oktober 2026/);
});
