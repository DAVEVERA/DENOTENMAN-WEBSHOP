import assert from "node:assert/strict";
import test from "node:test";
import { addCartItem } from "../../packages/commerce/src/cart/add-item";
import { calculateCart } from "../../packages/commerce/src/cart/calculate-cart";
import { createCart } from "../../packages/commerce/src/cart/create-cart";

test("addCartItem merges the same product and variant", () => {
  const cart = createCart("test-cart");
  const updated = addCartItem(cart, {
    productId: 1,
    variantId: "raw",
    name: "Amandelen",
    quantity: 2,
    unitPriceCents: 350,
  });
  const merged = addCartItem(updated, {
    productId: 1,
    variantId: "raw",
    name: "Amandelen",
    quantity: 1,
    unitPriceCents: 350,
  });

  assert.equal(merged.items[0]?.quantity, 3);
  assert.equal(calculateCart(merged.items).totals.subtotalCents, 1050);
});
