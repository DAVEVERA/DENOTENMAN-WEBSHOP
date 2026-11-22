import assert from "node:assert/strict";
import test from "node:test";
import { buildProductResearchQueries, triageResearchCandidates } from "../lib/ai-vindbaarheid/source-research";

const target = {
  productId: "p1",
  variantId: "v1",
  sku: "ABC-123",
  productName: "Amandelen gebrand",
  supplier: "Notenleverancier",
  weightGrams: 250,
  field: "ingredients" as const,
};

test("research queries are variant-specific and multilingual", () => {
  const queries = buildProductResearchQueries(target);
  assert.ok(queries.some((query) => query.includes("ABC-123")));
  assert.ok(queries.some((query) => query.includes("250g")));
  assert.ok(queries.some((query) => query.includes("ingredients")));
  assert.ok(queries.length >= 3);
});

test("empty product identifiers do not generate empty queries", () => {
  assert.deepEqual(buildProductResearchQueries({
    ...target, sku: "", productName: "", supplier: "", weightGrams: null,
  }), []);
});

test("a search snippet is never treated as verified product fact", () => {
  const candidates = triageResearchCandidates(target, [
    { url: "https://example.com/a", title: "Amandelen gebrand ABC-123", excerpt: "ingrediënten", sourceType: "supplier", retrievedAt: "2026-11-22T00:00:00Z" },
    { url: "https://example.com/b", title: "Other product", excerpt: "other", sourceType: "retailer", retrievedAt: "2026-11-22T00:00:00Z" },
  ]);
  assert.equal(candidates[0].exactSkuMentioned, true);
  assert.equal(candidates[0].needsManualVerification, true);
  assert.equal(candidates[1].needsManualVerification, true);
});

test("SKU match rejects identifiers that only share a prefix or suffix", () => {
  const candidates = triageResearchCandidates(target, [
    { url: "https://example.com/long", title: "Amandelen gebrand ABC-1234", excerpt: "wrong variant", sourceType: "unknown", retrievedAt: "2026-11-22T00:00:00Z" },
    { url: "https://example.com/suffixed", title: "Amandelen gebrand ABC-123-XL", excerpt: "wrong variant", sourceType: "unknown", retrievedAt: "2026-11-22T00:00:00Z" },
    { url: "https://example.com/exact", title: "Amandelen gebrand (ABC-123)", excerpt: "correct identifier in result", sourceType: "unknown", retrievedAt: "2026-11-22T00:00:00Z" },
  ]);
  assert.equal(candidates.find((item) => item.url.endsWith("/exact"))?.exactSkuMentioned, true);
  assert.equal(candidates.find((item) => item.url.endsWith("/long"))?.exactSkuMentioned, false);
  assert.equal(candidates.find((item) => item.url.endsWith("/suffixed"))?.exactSkuMentioned, false);
});
