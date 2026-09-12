import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Order, OrderItem } from "@prisma/client";
import { renderAftersalesEmail, renderGenericFlowEmail } from "../lib/aftersales/template";
import {
  defaultAftersalesDesign,
  deriveCanvasFromLegacyContent,
  type AftersalesDesign,
  type AftersalesLegacyContent,
  type AftersalesLegacyLocaleContent,
} from "../lib/aftersales/schema";

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

/** Derives a canvas + nl blockText for a legacy locale content, the same way
 * parseAftersalesContent's fallback branch does for steps saved before the
 * canvas editor shipped - lets these tests exercise renderAftersalesEmail /
 * renderGenericFlowEmail with the real canvas/blockText params they now
 * require, without hand-authoring a canvas per test. */
function canvasFor(content: AftersalesLegacyLocaleContent, design: AftersalesDesign = defaultAftersalesDesign) {
  const legacyLocales = { nl: content, en: content, fr: content } as AftersalesLegacyContent;
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(design, legacyLocales);
  return { canvas, blockText: blockTextByLocale.nl };
}

test("aftersales template personalizes content while escaping customer and product data", () => {
  const { canvas, blockText } = canvasFor(content);
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, canvas, blockText);
  assert.match(rendered.subject, /order-123/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, />Hoi Sophie</);
  assert.match(rendered.html, /Cashews &amp; amandelen/);
  assert.match(rendered.html, /<html lang="nl" dir="ltr">/);
  assert.match(rendered.html, /<title>Bestelling order-123 voor Sophie<\/title>/);
  assert.match(rendered.text, /2× Cashews & amandelen/);
});

test("shipping email links to PostNL when tracking data is available", () => {
  const { canvas, blockText } = canvasFor(content);
  const rendered = renderAftersalesEmail(order, "ORDER_FULFILLED", content, canvas, blockText);
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
  const { canvas, blockText } = canvasFor(content, design);
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, canvas, blockText, design);
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
  const { canvas, blockText } = canvasFor(content, design);
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, canvas, blockText, design);
  assert.doesNotMatch(rendered.html, /width="50%"/);
});

test("TABLE layout renders headers and rows, escaped", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "TABLE" as const,
    tableHeaders: ["Product", "Prijs"],
    tableRows: [{ cells: ["Amandelen 500g", "€ 6,95"] }, { cells: ["<script>x</script>", "€ 1,00"] }],
  };
  const { canvas, blockText } = canvasFor(content, design);
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, canvas, blockText, design);
  assert.match(rendered.html, /<th[^>]*>Product<\/th>/);
  assert.match(rendered.html, /<th[^>]*>Prijs<\/th>/);
  assert.match(rendered.html, /Amandelen 500g/);
  assert.doesNotMatch(rendered.html, /<script>x<\/script>/);
});

test("TABLE layout with no rows renders nothing extra", () => {
  const design = { ...defaultAftersalesDesign, layout: "TABLE" as const };
  const { canvas, blockText } = canvasFor(content, design);
  const rendered = renderAftersalesEmail(order, "ORDER_PAID", content, canvas, blockText, design);
  assert.doesNotMatch(rendered.html, /<thead>/);
});

test("renderGenericFlowEmail personalizes non-order triggers and never mentions an order", () => {
  const genericContent = {
    subject: "{{product_name}} is weer verkrijgbaar",
    previewText: "{{product_name}} kan weer besteld worden",
    heading: "Weer op voorraad",
    body: "Je vroeg om een seintje.\n\n{{product_name}}",
    buttonLabel: "Bekijk product",
  };
  const { canvas, blockText } = canvasFor(genericContent);
  const rendered = renderGenericFlowEmail({
    locale: "nl",
    content: genericContent,
    canvas,
    blockText,
    tokens: { product_name: "Amandelen <b>vers</b>", product_url: "https://denotenman.com/nl/producten/amandelen" },
    actionUrl: "https://denotenman.com/nl/producten/amandelen",
  });
  assert.match(rendered.subject, /Amandelen/);
  assert.match(rendered.html, /Amandelen &lt;b&gt;vers&lt;\/b&gt;/);
  assert.doesNotMatch(rendered.html, /Bestelnummer/);
  assert.match(rendered.html, /Vragen\? Beantwoord deze e-mail/);
});

test("renderGenericFlowEmail uses per-locale footer text", () => {
  const genericContent = {
    subject: "{{product_name}} is back",
    previewText: "back in stock",
    heading: "Back in stock",
    body: "{{product_name}}",
    buttonLabel: "View",
  };
  const { canvas, blockText } = canvasFor(genericContent);
  const rendered = renderGenericFlowEmail({
    locale: "en",
    content: genericContent,
    canvas,
    blockText,
    tokens: { product_name: "Almonds", product_url: "https://denotenman.com/en/products/almonds" },
    actionUrl: "https://denotenman.com/en/products/almonds",
  });
  assert.match(rendered.html, /Questions\? Reply to this email/);
});

test("renders business_name and contact_name for a business trigger", () => {
  const order = {
    id: "order-1",
    contactName: "Jan Jansen",
    contactEmail: "jan@example.invalid",
    locale: "nl",
    items: [],
    businessOrderList: {
      businessAccount: { companyName: "Restaurant De Notenboom", contactName: "Jan Jansen" },
    },
  } as unknown as Parameters<typeof renderAftersalesEmail>[0];
  const businessContent = {
    subject: "Betaald",
    previewText: "Betaald",
    heading: "Betaald",
    body: "Beste {{contact_name}} van {{business_name}}, je zakelijke bestelling is betaald.",
    buttonLabel: "Bekijk",
  };
  const { canvas, blockText } = canvasFor(businessContent);
  const rendered = renderAftersalesEmail(order, "BUSINESS_ORDER_PAID", businessContent, canvas, blockText, defaultAftersalesDesign, null);
  assert.match(rendered.html, /Jan Jansen/);
  assert.match(rendered.html, /Restaurant De Notenboom/);
});

test("a customHtml block escapes personalization token VALUES while keeping the admin's own HTML real, both for order emails and generic-flow emails", () => {
  const customHtmlCanvas = {
    rows: [{
      id: "r1",
      backgroundColor: "#ffffff",
      padding: 0,
      columns: [{
        id: "c1",
        widthFraction: 1,
        backgroundColor: "#ffffff",
        padding: 0,
        blocks: [{ id: "html1", type: "customHtml" as const }],
      }],
    }],
  };
  const blockText = { html1: "<b>Hallo {{customer_name}}</b>" };
  const maliciousName = "<script>alert(1)</script>";

  const orderRendered = renderAftersalesEmail(
    { ...order, contactName: maliciousName },
    "ORDER_PAID",
    content,
    customHtmlCanvas,
    blockText
  );
  // The admin's own <b> tags must survive as real markup, and the
  // customer-controlled name must be escaped - neither the whole block
  // escaped, nor the customer's markup left live.
  assert.match(orderRendered.html, /<b>Hallo &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/b>/);
  assert.doesNotMatch(orderRendered.html, /&lt;b&gt;Hallo/);
  assert.doesNotMatch(orderRendered.html, /<b>Hallo <script>/);

  const genericRendered = renderGenericFlowEmail({
    locale: "nl",
    content,
    canvas: customHtmlCanvas,
    blockText,
    tokens: { customer_name: maliciousName },
    actionUrl: "https://denotenman.com/nl/account",
  });
  assert.match(genericRendered.html, /<b>Hallo &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/b>/);
  assert.doesNotMatch(genericRendered.html, /&lt;b&gt;Hallo/);
  assert.doesNotMatch(genericRendered.html, /<b>Hallo <script>/);
});

test("an ordinary text block is not double-escaped when its token value contains an ampersand", () => {
  const textCanvas = {
    rows: [{
      id: "r1",
      backgroundColor: "#ffffff",
      padding: 0,
      columns: [{
        id: "c1",
        widthFraction: 1,
        backgroundColor: "#ffffff",
        padding: 0,
        blocks: [{ id: "t1", type: "text" as const, font: "SANS" as const, size: "STANDAARD" as const, color: "#141414", align: "left" as const, bold: false, italic: false }],
      }],
    }],
  };
  const rendered = renderAftersalesEmail(
    { ...order, contactName: "Sophie & Jan" },
    "ORDER_PAID",
    { ...content, body: "" },
    textCanvas,
    { t1: "Hallo {{customer_name}}" }
  );
  // Escaped exactly once: "&" -> "&amp;", not "&amp;amp;".
  assert.match(rendered.html, /Hallo Sophie &amp; Jan/);
  assert.doesNotMatch(rendered.html, /&amp;amp;/);
});

test("template.ts renders content through the shared canvas renderer, not a bespoke layout builder", () => {
  const source = readFileSync(path.join(__dirname, "..", "lib", "aftersales", "template.ts"), "utf8");
  assert.match(source, /import\s*\{\s*renderAftersalesCanvas\s*\}\s*from\s*"@\/lib\/aftersales\/canvas-renderer"/);
  assert.match(source, /renderAftersalesCanvas\(/);
});
