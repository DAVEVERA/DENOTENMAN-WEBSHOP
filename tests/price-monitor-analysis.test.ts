import assert from "node:assert/strict";
import test from "node:test";
import {
  assessDataQuality,
  buildPriceRecommendation,
  normalizePrice,
  parsePackageSize,
  parsePriceCents,
  scoreProductMatch,
  validatePriceAction,
} from "../lib/price-monitor/analysis";

test("parses Dutch and international price strings into cents", () => {
  assert.equal(parsePriceCents("€ 12,95"), 1295);
  assert.equal(parsePriceCents("1.234,56"), 123456);
  assert.equal(parsePriceCents("4.99"), 499);
  assert.equal(parsePriceCents("gratis"), null);
});

test("parses single and multi-pack quantities", () => {
  assert.deepEqual(parsePackageSize("Ongebrand 500 gram"), { quantity: 500, unit: "GRAM" });
  assert.deepEqual(parsePackageSize("2 x 50 gr snackpakket"), { quantity: 100, unit: "GRAM" });
  assert.deepEqual(parsePackageSize("Fles 1,5 liter"), { quantity: 1500, unit: "MILLILITER" });
});

test("normalizes weight prices to a kilogram", () => {
  assert.deepEqual(normalizePrice(325, 200, "GRAM"), {
    normalizedPriceCents: 1625,
    normalizedUnit: "KILOGRAM",
  });
});

test("data quality blocks missing packaging and suspect outliers", () => {
  const base = {
    sourceKey: "noten-nl",
    sourceUrl: "https://www.noten.nl/noten/amandelen",
    name: "Amandelen 500 gram",
    description: "Ongebrande amandelen",
    priceCents: 795,
    currency: "EUR",
    packageQuantity: 500,
    packageUnit: "GRAM" as const,
    inStock: true,
  };
  assert.equal(assessDataQuality(base).safeForAnalysis, true);
  assert.equal(assessDataQuality({ ...base, packageQuantity: null }).safeForAnalysis, false);
  assert.ok(assessDataQuality({ ...base, priceCents: 150_000 }).flags.includes("SUSPECT_OUTLIER"));
});

test("product matching rewards exact SKU and compatible name plus weight", () => {
  const exact = scoreProductMatch({
    variantId: "v1",
    ownSku: "ABC-500",
    ownName: "Ongebrande amandelen 500 gram",
    ownWeightGrams: 500,
    competitorSku: "abc500",
    competitorName: "Amandelen ongebrand 500 gram",
    competitorQuantity: 500,
    competitorUnit: "GRAM",
  });
  assert.equal(exact.score, 98);
  assert.equal(exact.exact, true);
  const likely = scoreProductMatch({
    variantId: "v1",
    ownSku: "OWN-1",
    ownName: "Ongebrande amandelen 500 gram",
    ownWeightGrams: 500,
    competitorName: "Amandelen ongebrand 500 gram",
    competitorQuantity: 500,
    competitorUnit: "GRAM",
  });
  assert.ok(likely.score >= 70);
});

test("price coach keeps small differences and bounds significant actions", () => {
  const keep = buildPriceRecommendation({
    currentPriceCents: 1000,
    ownWeightGrams: 500,
    competitorNormalizedPriceCents: 1900,
    competitorNormalizedUnit: "KILOGRAM",
    matchConfidenceScore: 95,
    dataQualityScore: 95,
  });
  assert.equal(keep.type, "KEEP");

  const lower = buildPriceRecommendation({
    currentPriceCents: 1200,
    ownWeightGrams: 500,
    competitorNormalizedPriceCents: 1800,
    competitorNormalizedUnit: "KILOGRAM",
    matchConfidenceScore: 95,
    dataQualityScore: 95,
  });
  assert.equal(lower.type, "LOWER");
  assert.ok(lower.suggestedPriceCents >= Math.round(1200 * 0.88));
  assert.ok(lower.suggestedPriceCents < 1200);

  const raise = buildPriceRecommendation({
    currentPriceCents: 800,
    ownWeightGrams: 500,
    competitorNormalizedPriceCents: 2200,
    competitorNormalizedUnit: "KILOGRAM",
    matchConfidenceScore: 95,
    dataQualityScore: 95,
  });
  assert.equal(raise.type, "RAISE");
  assert.ok(raise.suggestedPriceCents <= 880);
});

test("low confidence forces review and price changes require margin confirmation", () => {
  assert.equal(
    buildPriceRecommendation({
      currentPriceCents: 1000,
      ownWeightGrams: 500,
      competitorNormalizedPriceCents: 1500,
      competitorNormalizedUnit: "KILOGRAM",
      matchConfidenceScore: 60,
      dataQualityScore: 95,
    }).type,
    "REVIEW"
  );
  assert.deepEqual(
    validatePriceAction({
      currentPriceCents: 1000,
      expectedCurrentPriceCents: 1000,
      targetPriceCents: 950,
      marginChecked: false,
    }),
    { ok: false, error: "MARGIN_CHECK_REQUIRED" }
  );
  assert.deepEqual(
    validatePriceAction({
      currentPriceCents: 1000,
      expectedCurrentPriceCents: 1000,
      targetPriceCents: 950,
      marginChecked: true,
    }),
    { ok: true }
  );
  assert.deepEqual(
    validatePriceAction({
      currentPriceCents: 1000,
      expectedCurrentPriceCents: 1000,
      targetPriceCents: 1000,
      marginChecked: true,
    }),
    { ok: false, error: "PRICE_UNCHANGED" }
  );
});

test("unsafe competitor data can never become an executable price action", () => {
  const recommendation = buildPriceRecommendation({
    currentPriceCents: 1200,
    ownWeightGrams: 500,
    competitorNormalizedPriceCents: 1800,
    competitorNormalizedUnit: "KILOGRAM",
    matchConfidenceScore: 95,
    dataQualityScore: 95,
    qualityFlags: ["OUT_OF_STOCK"],
  });
  assert.equal(recommendation.type, "REVIEW");
  assert.match(recommendation.rationale, /niet op voorraad/i);
});
