import assert from "node:assert/strict";
import test from "node:test";
import { calculateTotals } from "../../packages/commerce/src/pricing/calculate-totals";

test("calculateTotals returns subtotal, tax and total", () => {
  const totals = calculateTotals({
    lines: [{ unitPriceCents: 1000, quantity: 2 }],
    shippingCents: 500,
    vatRate: 0.09,
  });

  assert.equal(totals.subtotalCents, 2000);
  assert.equal(totals.shippingCents, 500);
  assert.equal(totals.taxCents, 225);
  assert.equal(totals.totalCents, 2725);
});
