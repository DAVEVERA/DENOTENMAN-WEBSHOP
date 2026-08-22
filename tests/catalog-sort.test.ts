import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCatalogSort,
  normalizeCatalogSort,
  popularityScore,
  sortCatalogCandidates,
  type CatalogSortCandidate,
} from "../lib/catalog-sort";

type Product = { id: string };

function candidate(
  id: string,
  priceCents: number,
  soldQuantity: number,
  viewCount: number
): CatalogSortCandidate<Product> {
  return {
    product: { id },
    id,
    name: id,
    priceCents,
    soldQuantity,
    viewCount,
  };
}

const products = [
  candidate("amandel", 499, 2, 30),
  candidate("cashew", 399, 8, 2),
  candidate("pecan", 699, 0, 80),
];

test("catalog sort input is allow-listed with a deterministic default", () => {
  assert.equal(defaultCatalogSort, "POPULAR");
  assert.equal(normalizeCatalogSort(" price_asc "), "PRICE_ASC");
  assert.equal(normalizeCatalogSort("MOST_VIEWED"), "MOST_VIEWED");
  assert.equal(normalizeCatalogSort("DROP TABLE Product"), "POPULAR");
});

test("price sorts use the supplied display price in both directions", () => {
  assert.deepEqual(
    sortCatalogCandidates(products, "PRICE_ASC", "nl").map(({ id }) => id),
    ["cashew", "amandel", "pecan"]
  );
  assert.deepEqual(
    sortCatalogCandidates(products, "PRICE_DESC", "nl").map(({ id }) => id),
    ["pecan", "amandel", "cashew"]
  );
});

test("sales, views and blended popularity remain distinct and deterministic", () => {
  assert.deepEqual(
    sortCatalogCandidates(products, "BEST_SELLING", "nl").map(({ id }) => id),
    ["cashew", "amandel", "pecan"]
  );
  assert.deepEqual(
    sortCatalogCandidates(products, "MOST_VIEWED", "nl").map(({ id }) => id),
    ["pecan", "amandel", "cashew"]
  );
  assert.deepEqual(
    sortCatalogCandidates(products, "POPULAR", "nl").map(({ id }) => id),
    ["pecan", "cashew", "amandel"]
  );
  assert.equal(popularityScore(products[0]), 40);
});
