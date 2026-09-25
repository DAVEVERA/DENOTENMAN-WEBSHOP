import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateShippingCents,
  calculateTotalWeightGrams,
  getShippingPolicy,
  shippingRateForWeight,
} from "../lib/shipping";

test("totals authoritative variant weights including quantity", () => {
  assert.equal(
    calculateTotalWeightGrams([
      { weightGrams: 250, quantity: 2 },
      { weightGrams: 1_000, quantity: 3 },
    ]),
    3_500
  );
  assert.equal(calculateTotalWeightGrams([]), null);
  assert.equal(calculateTotalWeightGrams([{ weightGrams: 0, quantity: 1 }]), null);
});

test("applies the flat Netherlands rate at every weight", () => {
  assert.equal(shippingRateForWeight("NL", 1), 495);
  assert.equal(shippingRateForWeight("NL", 3_000), 495);
  assert.equal(shippingRateForWeight("NL", 25_000), 495);
});

test("applies the flat Belgium rate at every weight", () => {
  assert.equal(shippingRateForWeight("BE", 1), 695);
  assert.equal(shippingRateForWeight("BE", 2_000), 695);
  assert.equal(shippingRateForWeight("BE", 25_000), 695);
});

test("uses the country-specific free-shipping thresholds", () => {
  assert.equal(getShippingPolicy("NL").freeShippingThresholdCents, 5_000);
  assert.equal(getShippingPolicy("BE").freeShippingThresholdCents, 7_000);

  assert.equal(
    calculateShippingCents({ country: "NL", subtotalCents: 4_999, totalWeightGrams: 500 }),
    495
  );
  assert.equal(
    calculateShippingCents({ country: "NL", subtotalCents: 5_000, totalWeightGrams: 500 }),
    0
  );
  assert.equal(
    calculateShippingCents({ country: "BE", subtotalCents: 6_999, totalWeightGrams: 500 }),
    695
  );
  assert.equal(
    calculateShippingCents({ country: "BE", subtotalCents: 7_000, totalWeightGrams: 500 }),
    0
  );
});

test("keeps pickup and empty carts free", () => {
  assert.equal(
    calculateShippingCents({
      country: "BE",
      subtotalCents: 1_000,
      totalWeightGrams: 5_000,
      deliveryMethod: "PICKUP",
    }),
    0
  );
  assert.equal(
    calculateShippingCents({ country: "NL", subtotalCents: 0, totalWeightGrams: null }),
    0
  );
});

test("uses the country rate when a legacy browser cart has no weight", () => {
  assert.equal(shippingRateForWeight("NL", null), 495);
  assert.equal(shippingRateForWeight("BE", null), 695);
});
