import assert from "node:assert/strict";
import test from "node:test";
import type { Order, OrderItem } from "@prisma/client";
import { renderAftersalesEmail, renderGenericFlowEmail } from "../lib/aftersales/template";
import { defaultAftersalesDesign } from "../lib/aftersales/schema";

const order = {
  id: "order-123",
  locale: "nl",
  contactName: "Sophie <script>alert(1)</script>",
  contactEmail: "sophie@example.com",
  totalCents: 4295,
  postnlTrackingCode: "3SNOTEN123",
  shippingPostalCode: "1234 AB",
  shippingCountry: "NL",
  items: [{
    id: "item-1",
    orderId: "order-123",
    variantId: "variant-1",
    sku: null,
    productName: "Cashews & amandelen",
    variantLabel: "500 gram",
    quantity: 2,
    unitPriceCents: 695,
  } satisfies OrderItem],
} as Order & { items: OrderItem[] };

const content = {
  subject: "Bestelling {{order_number}} voor {{first_name}}",
  previewText: "Je bestelling is onderweg",
  heading: "Hoi {{first_name}}",
  body: "Je bestelling van {{order_total}} is verzonden.",
  buttonLabel: "Volg je bestelling",
};

test("aftersales template personalizes content while escaping customer and product data", () => {
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content);
  assert.match(rendered.subject, /order-123/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, /<h1[^>]*>Hoi Sophie<\/h1>/);
  assert.match(rendered.html, /Cashews &amp; amandelen/);
  assert.match(rendered.html, /<html lang="nl" dir="ltr">/);
  assert.match(rendered.html, /<title>Bestelling order-123 voor Sophie<\/title>/);
  assert.match(rendered.text, /2× Cashews & amandelen/);
});

test("shipping email links to PostNL when tracking data is available", () => {
  const rendered = renderAftersalesEmail(order, "ORDER_FULFILLED", content);
  assert.match(rendered.actionUrl, /^https:\/\/jouw\.postnl\.nl\/track-and-trace\//);
  assert.match(rendered.html, /3SNOTEN123/);
  assert.doesNotMatch(rendered.html, /Cashews &amp; amandelen/);
});

test("GRID_2COL layout renders up to 4 items in a 2-per-row table, escaped", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "GRID_2COL" as const,
    gridItems: [
      { imageUrl: "https://cdn.example.com/a.jpg", imageAlt: "A", heading: "Amandelen <b>vers</b>", body: "Om te bakken" },
      { imageUrl: null, imageAlt: "", heading: "Cashews", body: "Puur genot" },
      { imageUrl: null, imageAlt: "", heading: "Walnoten", body: "" },
    ],
  };
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, design);
  assert.match(rendered.html, /Amandelen &lt;b&gt;vers&lt;\/b&gt;/);
  assert.match(rendered.html, /Cashews/);
  assert.match(rendered.html, /Walnoten/);
  assert.match(rendered.html, /<img src="https:\/\/cdn\.example\.com\/a\.jpg"/);
  // 3 items -> 2 rows (2 + 1), never a single row with 3 cells.
  const rowCount = (rendered.html.match(/<tr>/g) ?? []).length;
  assert.ok(rowCount >= 2, `expected at least 2 <tr> rows for 3 grid items, got ${rowCount}`);
});

test("GRID_2COL layout omits empty items and renders nothing when all items are blank", () => {
  const design = { ...defaultAftersalesDesign, layout: "GRID_2COL" as const, gridItems: [{ imageUrl: null, imageAlt: "", heading: "", body: "" }] };
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, design);
  assert.doesNotMatch(rendered.html, /width="50%"/);
});

test("TABLE layout renders headers and rows, escaped", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "TABLE" as const,
    tableHeaders: ["Product", "Prijs"],
    tableRows: [{ cells: ["Amandelen 500g", "€ 6,95"] }, { cells: ["<script>x</script>", "€ 1,00"] }],
  };
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, design);
  assert.match(rendered.html, /<th[^>]*>Product<\/th>/);
  assert.match(rendered.html, /<th[^>]*>Prijs<\/th>/);
  assert.match(rendered.html, /Amandelen 500g/);
  assert.doesNotMatch(rendered.html, /<script>x<\/script>/);
});

test("TABLE layout with no rows renders nothing extra", () => {
  const design = { ...defaultAftersalesDesign, layout: "TABLE" as const };
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, design);
  assert.doesNotMatch(rendered.html, /<thead>/);
});

test("renderGenericFlowEmail personalizes non-order triggers and never mentions an order", () => {
  const rendered = renderGenericFlowEmail({
    locale: "nl",
    content: {
      subject: "{{product_name}} is weer verkrijgbaar",
      previewText: "{{product_name}} kan weer besteld worden",
      heading: "Weer op voorraad",
      body: "Je vroeg om een seintje.\n\n{{product_name}}",
      buttonLabel: "Bekijk product",
    },
    tokens: { product_name: "Amandelen <b>vers</b>", product_url: "https://denotenman.com/nl/producten/amandelen" },
    actionUrl: "https://denotenman.com/nl/producten/amandelen",
  });
  assert.match(rendered.subject, /Amandelen/);
  assert.match(rendered.html, /Amandelen &lt;b&gt;vers&lt;\/b&gt;/);
  assert.doesNotMatch(rendered.html, /Bestelnummer/);
  assert.match(rendered.html, /Vragen\? Beantwoord deze e-mail/);
});

test("renderGenericFlowEmail uses per-locale footer text", () => {
  const rendered = renderGenericFlowEmail({
    locale: "en",
    content: {
      subject: "{{product_name}} is back",
      previewText: "back in stock",
      heading: "Back in stock",
      body: "{{product_name}}",
      buttonLabel: "View",
    },
    tokens: { product_name: "Almonds", product_url: "https://denotenman.com/en/products/almonds" },
    actionUrl: "https://denotenman.com/en/products/almonds",
  });
  assert.match(rendered.html, /Questions\? Reply to this email/);
});
