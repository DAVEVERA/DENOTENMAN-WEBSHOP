import assert from "node:assert/strict";
import {
  calculateShipmentWeightGrams,
  determineLabelAction,
} from "../lib/postnl";

assert.equal(
  calculateShipmentWeightGrams([
    { quantity: 2, variant: { weightGrams: 500 } },
    { quantity: 4, variant: { weightGrams: 250 } },
    { quantity: 1, variant: { weightGrams: 1_000 } },
  ]),
  3_000
);

assert.throws(
  () => calculateShipmentWeightGrams([]),
  /Geen geldig verzendgewicht/
);

assert.equal(determineLabelAction("PAID", false), "create");
assert.equal(determineLabelAction("FULFILLED", false), "create");
assert.equal(determineLabelAction("PAID", true), "reuse");
assert.equal(determineLabelAction("FULFILLED", true), "reuse");
assert.equal(determineLabelAction("PENDING", false), "reject");
assert.equal(determineLabelAction("CANCELLED", false), "reject");
assert.equal(determineLabelAction("CANCELLED", true), "reject");
assert.equal(determineLabelAction("REFUNDED", false), "reject");

console.log("postnl tests passed");
