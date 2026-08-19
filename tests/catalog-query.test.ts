import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogPageSize,
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
