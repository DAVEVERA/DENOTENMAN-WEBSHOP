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

test("applies Netherlands weight tiers through the exact 3 kg boundary", () => {
  assert.equal(shippingRateForWeight("NL", 1), 595);
  assert.equal(shippingRateForWeight("NL", 3_000), 595);
  assert.equal(shippingRateForWeight("NL", 3_001), 695);
  assert.equal(shippingRateForWeight("NL", 10_000), 695);
  assert.equal(shippingRateForWeight("NL", 10_001), 695);
});

test("applies Belgium weight tiers through the exact 2 kg boundary", () => {
  assert.equal(shippingRateForWeight("BE", 1), 665);
  assert.equal(shippingRateForWeight("BE", 2_000), 665);
  assert.equal(shippingRateForWeight("BE", 2_001), 875);
  assert.equal(shippingRateForWeight("BE", 25_000), 875);
});

test("uses the country-specific free-shipping thresholds", () => {
  assert.equal(getShippingPolicy("NL").freeShippingThresholdCents, 5_000);
  assert.equal(getShippingPolicy("BE").freeShippingThresholdCents, 7_000);

  assert.equal(
    calculateShippingCents({ country: "NL", subtotalCents: 4_999, totalWeightGrams: 500 }),
    595
  );
  assert.equal(
    calculateShippingCents({ country: "NL", subtotalCents: 5_000, totalWeightGrams: 500 }),
    0
  );
  assert.equal(
    calculateShippingCents({ country: "BE", subtotalCents: 6_999, totalWeightGrams: 500 }),
    665
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

test("uses the highest country rate when a legacy browser cart has no weight", () => {
  assert.equal(shippingRateForWeight("NL", null), 695);
  assert.equal(shippingRateForWeight("BE", null), 875);
});
