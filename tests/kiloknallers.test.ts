import assert from "node:assert/strict";
import test from "node:test";
import {
  KILOKNALLER_MINIMUM_BASE_UNITS,
  isKiloknallerCategory,
  isKiloknallerVariant,
} from "../lib/kiloknallers";

test("includes active variants from 1000 gram or milliliter", () => {
  assert.equal(isKiloknallerVariant("WEIGHT", 1000, true), true);
  assert.equal(isKiloknallerVariant("VOLUME", 1000, true), true);
  assert.equal(isKiloknallerVariant("WEIGHT", 999, true), false);
  assert.equal(isKiloknallerVariant("VOLUME", 999, true), false);
  assert.equal(isKiloknallerVariant("WEIGHT", 1500, false), false);
  assert.equal(KILOKNALLER_MINIMUM_BASE_UNITS, 1000);
});

test("applies the automatic collection only to the canonical actions category", () => {
  assert.equal(isKiloknallerCategory("acties"), true);
  assert.equal(isKiloknallerCategory("zomeractie"), false);
});
