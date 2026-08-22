import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogVariantWhere,
  catalogPageSize,
  maxCatalogSortCandidates,
  normalizeCatalogFilterValues,
} from "../lib/queries";

test("catalog filter values are normalized, deduplicated, and bounded", () => {
  assert.equal(catalogPageSize, 24);
  assert.deepEqual(
    normalizeCatalogFilterValues([" RAW ", "RAW", "noten", "", "x".repeat(101)]),
    ["RAW", "noten"]
  );
  assert.equal(
    normalizeCatalogFilterValues(Array.from({ length: 80 }, (_, index) => `filter-${index}`)).length,
    50
  );
});

test("all selected preparation, salting and coating values constrain one active variant", () => {
  assert.deepEqual(
    buildCatalogVariantWhere(["RAW"], ["SALTED"], ["CHOCOLATE"]),
    {
      isActive: true,
      preparation: { in: ["RAW"] },
      salting: { in: ["SALTED"] },
      coating: { in: ["CHOCOLATE"] },
    }
  );
  assert.deepEqual(buildCatalogVariantWhere([], [], []), { isActive: true });
  assert.equal(maxCatalogSortCandidates, 500);
});
