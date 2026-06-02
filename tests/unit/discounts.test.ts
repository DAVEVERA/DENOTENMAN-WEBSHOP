import assert from "node:assert/strict";
import test from "node:test";
import { calculateDiscountCents } from "../../packages/commerce/src/pricing/calculate-discount";

test("calculateDiscountCents caps discount at subtotal", () => {
  assert.equal(
    calculateDiscountCents({
      subtotalCents: 1000,
      fixedDiscountCents: 900,
      percentage: 0.5,
    }),
    1000,
  );
});
