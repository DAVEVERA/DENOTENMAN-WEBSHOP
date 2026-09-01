import assert from "node:assert/strict";
import test from "node:test";
import type { Order, OrderItem } from "@prisma/client";
import { renderAftersalesEmail } from "../lib/aftersales/template";

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
