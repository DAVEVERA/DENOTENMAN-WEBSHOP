import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductDisplayPrice } from "../lib/product-price";

test("uses the lowest active variant price and marks a real price range", () => {
  const result = resolveProductDisplayPrice(999, null, [
    { priceCents: 795, regularPriceCents: 795, salePriceCents: null },
    { priceCents: 495, regularPriceCents: 595, salePriceCents: 495 },
  ]);

  assert.deepEqual(result, {
    priceCents: 495,
    regularPriceCents: 595,
    salePriceCents: 495,
    hasVariablePrice: true,
  });
});

test("does not mark equal effective variant prices as variable", () => {
  const result = resolveProductDisplayPrice(999, null, [
    { priceCents: 695, regularPriceCents: 695, salePriceCents: null },
    { priceCents: 695, regularPriceCents: 795, salePriceCents: 695 },
  ]);

  assert.equal(result.priceCents, 695);
  assert.equal(result.hasVariablePrice, false);
});

test("falls back to the product price when no active variants exist", () => {
  assert.deepEqual(resolveProductDisplayPrice(795, 695, []), {
    priceCents: 695,
    regularPriceCents: 795,
    salePriceCents: 695,
    hasVariablePrice: false,
  });
});
