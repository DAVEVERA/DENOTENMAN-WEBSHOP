import assert from "node:assert/strict";
import {
  calculateDiscount,
  evaluateFirstOrderDiscount,
  hasDiscountCode,
  MARKET_DISCOUNT_CODES,
} from "../lib/discounts";

assert.deepEqual(calculateDiscount(10_000, "marktactie10"), {
  code: "marktactie10",
  percent: 10,
  discountCents: 1_000,
});
assert.deepEqual(calculateDiscount(10_000, "rubensmarkt"), {
  code: "rubensmarkt",
  percent: 10,
  discountCents: 1_000,
});
assert.equal(calculateDiscount(999, "  RUBENSMARKT  ")?.discountCents, 100);
assert.equal(calculateDiscount(999, "  MARKTACTIE10  ")?.discountCents, 100);
assert.equal(calculateDiscount(10_000, "Rubensmarkt2026"), null);
assert.equal(calculateDiscount(10_000, "rubensmarkt,marktactie10"), null);
assert.equal(calculateDiscount(10_000, "rubensmarkt marktactie10"), null);
assert.equal(calculateDiscount(10_000, "verkeerd"), null);
assert.equal(calculateDiscount(10_000, ""), null);
assert.equal(hasDiscountCode("   "), false);
assert.equal(hasDiscountCode(MARKET_DISCOUNT_CODES[0]), true);

assert.deepEqual(evaluateFirstOrderDiscount(10_000, "marktactie10", false), {
  status: "applied",
  discount: {
    code: "marktactie10",
    percent: 10,
    discountCents: 1_000,
  },
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "rubensmarkt", true), {
  status: "ineligible",
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "onbekend", false), {
  status: "invalid",
});
assert.deepEqual(evaluateFirstOrderDiscount(10_000, "   ", true), {
  status: "none",
});

console.log("discount tests passed");
