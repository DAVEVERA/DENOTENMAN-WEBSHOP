import assert from "node:assert/strict";
import test from "node:test";
import {
  getNutFamilyForProductSku,
  nutFamilySlugs,
} from "../lib/catalog-taxonomy";

test("places every current single-nut SKU in its customer-facing nut family", () => {
  const expected = {
    "NOT-1001-250-P": "paranoten",
    "NOT-1002-200-P": "pecannoten",
    "NOT-1003-200-P": "pecannoten",
    "NOT-1004-200-P": "pecannoten",
    "NOT-1005-VAR-P": "pistachenoten",
    "NOT-1006-100-P": "pistachenoten",
    "NOT-1007-250-P": "pistachenoten",
    "NOT-1008-200-P": "walnoten",
    "NOT-1009-1000-P": "walnoten",
    "NOT-1010-250-P": "amandelen",
    "NOT-1011-250-P": "amandelen",
    "NOT-1012-250-P": "amandelen",
    "NOT-1013-250-P": "amandelen",
    "NOT-1014-250-P": "cashewnoten",
    "NOT-1015-250-P": "cashewnoten",
    "NOT-1016-250-P": "cashewnoten",
    "NOT-1017-500-P": "cashewnoten",
    "NOT-1018-250-P": "hazelnoten",
    "NOT-1019-250-P": "hazelnoten",
    "NOT-1020-250-P": "hazelnoten",
    "NOT-1021-200-P": "macadamias",
    "NOT-1022-200-P": "macadamias",
    "NOT-1023-200-P": "macadamias",
  } as const;

  for (const [sku, family] of Object.entries(expected)) {
    assert.equal(getNutFamilyForProductSku(sku), family, sku);
  }
});

test("keeps peanuts and nut mixes as direct nut families", () => {
  assert.equal(getNutFamilyForProductSku("PIN-2001-250-P"), "pinda-s");
  assert.equal(getNutFamilyForProductSku("MIX-3001-250-P"), "notenmixen");
});

test("fails closed when a new single-nut SKU has no family mapping", () => {
  assert.throws(
    () => getNutFamilyForProductSku("NOT-9999-250-P"),
    /Geen notenfamilie vastgelegd/
  );
  assert.equal(getNutFamilyForProductSku("CHO-5001-250-P"), undefined);
  assert.deepEqual(nutFamilySlugs, [
    "amandelen",
    "cashewnoten",
    "hazelnoten",
    "macadamias",
    "paranoten",
    "pecannoten",
    "walnoten",
    "pinda-s",
    "pistachenoten",
    "notenmixen",
  ]);
});
