import assert from "node:assert/strict";
import test from "node:test";
import { proposeShippingAddons } from "../lib/shipping-addons";

test("shipping add-ons cross the threshold without expensive overshoot", () => {
  const results = proposeShippingAddons(4600, 5000, [
    { id: "too-cheap", priceCents: 100, stock: 3 },
    { id: "exact", priceCents: 400, stock: 2 },
    { id: "close", priceCents: 450, stock: 2 },
    { id: "too-expensive", priceCents: 2000, stock: 2 },
    { id: "in-cart", priceCents: 400, stock: 2 },
  ], new Set(["in-cart"]));
  assert.deepEqual(results.map((item) => item.id), ["exact", "close"]);
  assert.ok(results.every((item) => 4600 + (["exact", "in-cart"].includes(item.id) ? 400 : 450) * item.quantity >= 5000));
});

test("shipping add-ons require enough stock and stop after free shipping", () => {
  assert.deepEqual(proposeShippingAddons(5000, 5000, [{ id: "a", priceCents: 500, stock: 1 }], new Set()), []);
  assert.deepEqual(proposeShippingAddons(4000, 5000, [{ id: "a", priceCents: 500, stock: 1 }], new Set()), []);
});
