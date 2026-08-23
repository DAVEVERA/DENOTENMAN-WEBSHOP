import assert from "node:assert/strict";
import test from "node:test";
import {
  chocolateFamilySlugs,
  getChocolatePlacementForProductSku,
  getNutFamilyForProductSku,
  getSeedPlacementForProductSku,
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
    "NOT-1024-1000-P": "walnoten",
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

test("places every chocolate product in a real requested leaf category", () => {
  const expected = {
    "CHO-5001-250-P": "snoep-nougat",
    "CHO-5002-250-P": "snoep-nougat",
    "CHO-5003-300-P": "snoep-nougat",
    "CHO-5004-250-P": "chocolade-amandelen",
    "CHO-5005-250-P": "chocolade-amandelen",
    "CHO-5006-250-P": "chocolade-amandelen",
    "CHO-5007-250-P": "chocolade-amandelen",
    "CHO-5008-250-P": "chocolade-amandelen",
    "CHO-5009-500-P": "snoep-nougat",
    "CHO-5010-250-P": "chocolade-rotsjes",
    "CHO-5011-250-P": "chocolade-rotsjes",
    "CHO-5012-250-P": "chocolade-rotsjes",
    "CHO-5013-250-P": "chocolade-rotsjes",
    "CHO-5014-250-P": "chocolade-rotsjes",
    "CHO-5015-250-P": "chocolade-rotsjes",
    "CHO-5016-250-P": "chocolade-rotsjes",
    "CHO-5017-VAR-P": "snoep-nougat",
    "CHO-5018-200-P": "snoep-nougat",
    "CHO-5019-180-P": "chocolade-hazelnoten",
    "CHO-5020-200-P": "chocolade-pecannoten",
    "CHO-5021-250-P": "chocolade-pindas",
    "CHO-5022-250-P": "chocolade-pindas",
    "CHO-5023-250-P": "chocolade-rozijnen",
    "CHO-5024-250-P": "chocolade-rozijnen",
    "CHO-5025-250-P": "chocolade-rozijnen",
    "CHO-5026-250-P": "chocolade-rozijnen",
    "CHO-5027-250-P": "studenten-flikken",
    "CHO-5028-250-P": "studenten-flikken",
    "CHO-5029-250-P": "studenten-flikken",
    "CHO-5030-350-P": "chocolade",
  } as const;

  for (const [sku, family] of Object.entries(expected)) {
    assert.equal(getChocolatePlacementForProductSku(sku), family, sku);
  }
  assert.equal(getChocolatePlacementForProductSku("CHO-9999-250-P"), undefined);
  assert.deepEqual(chocolateFamilySlugs, [
    "chocolade-amandelen",
    "chocolade-rotsjes",
    "chocolade-hazelnoten",
    "chocolade-pecannoten",
    "chocolade-pindas",
    "chocolade-rozijnen",
    "studenten-flikken",
  ]);
});

test("places every kernel and seed product in a real leaf category", () => {
  const expected = {
    "PIT-7001-250-P": "lijnzaad",
    "PIT-7002-250-P": "lijnzaad",
    "PIT-7003-100-P": "pijnboompitten",
    "PIT-7004-250-P": "pompoenpitten",
    "PIT-7005-500-P": "zadenmixen-granen",
    "PIT-7006-250-P": "zadenmixen-granen",
    "PIT-7007-250-P": "sesamzaad",
    "PIT-7008-250-P": "zadenmixen-granen",
    "PIT-7009-250-P": "zonnebloempitten",
    "PIT-7010-250-P": "chiazaad",
    "PIT-7011-250-P": "hennepzaad",
    "PIT-7012-250-P": "sesamzaad",
    "PIT-7013-VAR-P": "maanzaad",
  } as const;

  for (const [sku, category] of Object.entries(expected)) {
    assert.equal(getSeedPlacementForProductSku(sku), category, sku);
  }
});

test("fails closed when a new kernel or seed SKU has no leaf mapping", () => {
  assert.throws(
    () => getSeedPlacementForProductSku("PIT-9999-250-P"),
    /Geen pitten- of zadenfamilie vastgelegd/
  );
  assert.equal(getSeedPlacementForProductSku("NOT-1001-250-P"), undefined);
});
