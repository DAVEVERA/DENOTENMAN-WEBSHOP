import assert from "node:assert/strict";
import test from "node:test";

import {
  assessCopywriterCompleteness,
  type CopywriterCompletenessStatus,
} from "../lib/design-studio/copywriter/completeness";
import {
  buildCopywriterSourceSnapshot,
  type CopywriterSourceInput,
} from "../lib/design-studio/copywriter/snapshot";

function completeSource(): CopywriterSourceInput {
  return {
    product: {
      id: "product-1",
      sku: "AMAN-250",
      slug: "amandelen-ongebrand",
      updatedAt: "2026-09-08T08:00:00.000Z",
      basePriceCents: 650,
      salePriceCents: null,
      currency: "EUR",
      unit: "WEIGHT",
      isActive: true,
    },
    translation: {
      locale: "nl",
      name: "Ongebrande amandelen",
      slug: "ongebrande-amandelen",
      shortDescription: "Ongebrande amandelen met een stevige beet, voor tussendoor of door het ontbijt.",
      descriptionHtml: "<p>Deze ongebrande amandelen hebben een stevige beet. Eet ze zo of meng ze door je ontbijt.</p>",
      seoTitle: "Ongebrande amandelen | De Notenman",
      metaDescription: "Bestel ongebrande amandelen bij De Notenman. Met een stevige beet, voor tussendoor of door je ontbijt.",
      promotionText: null,
    },
    attributes: [
      { key: "ingredients", value: "AMANDELEN" },
      { key: "allergens", value: "AMANDELEN" },
      { key: "mayContainTraces", value: "Kan sporen bevatten van andere NOTEN en PINDA'S." },
    ],
    categories: [],
    variants: [],
  };
}

function statusFor(mutator?: (source: CopywriterSourceInput) => void): CopywriterCompletenessStatus {
  const source = completeSource();
  mutator?.(source);
  return assessCopywriterCompleteness(buildCopywriterSourceSnapshot(source)).status;
}

test("a product with all required applicable fields is complete", () => {
  const result = assessCopywriterCompleteness(buildCopywriterSourceSnapshot(completeSource()));
  assert.equal(result.status, "COMPLETE");
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.reviewFields, []);
  assert.deepEqual(result.attentionAreas, []);
});

test("missing copy, SEO, and product facts receive their deterministic statuses", () => {
  assert.equal(statusFor((source) => { source.translation.shortDescription = null; }), "MISSING_TEXT");
  assert.equal(statusFor((source) => { source.translation.seoTitle = null; }), "MISSING_SEO");
  assert.equal(statusFor((source) => {
    source.attributes = source.attributes.filter(({ key }) => key !== "allergens");
  }), "MISSING_PRODUCT_FACTS");
});

test("safety-first precedence keeps every missing area visible", () => {
  const source = completeSource();
  source.translation.shortDescription = null;
  source.translation.metaDescription = null;
  source.attributes = [];
  const result = assessCopywriterCompleteness(buildCopywriterSourceSnapshot(source));

  assert.equal(result.status, "MISSING_PRODUCT_FACTS");
  assert.deepEqual(result.attentionAreas, ["TEXT", "SEO", "PRODUCT_FACTS"]);
  assert.deepEqual(result.missingFields, [
    "shortDescription",
    "metaDescription",
    "ingredients",
    "allergens",
    "mayContainTraces",
  ]);
});

test("invalid limits, slug syntax, and an unverified promotion require review", () => {
  assert.equal(statusFor((source) => { source.translation.name = "a".repeat(181); }), "NEEDS_REVIEW");
  assert.equal(statusFor((source) => { source.translation.slug = "Geen Geldige Slug"; }), "NEEDS_REVIEW");
  assert.equal(statusFor((source) => { source.translation.slug = "a"; }), "NEEDS_REVIEW");
  assert.equal(statusFor((source) => { source.translation.promotionText = "Alleen vandaag extra voordelig"; }), "NEEDS_REVIEW");
});

test("promotion text is required only when a real lower sale price exists", () => {
  const missingPromotion = completeSource();
  missingPromotion.product.salePriceCents = 550;
  const missing = assessCopywriterCompleteness(buildCopywriterSourceSnapshot(missingPromotion));
  assert.equal(missing.status, "MISSING_TEXT");
  assert.deepEqual(missing.missingFields, ["promotionText"]);

  missingPromotion.translation.promotionText = "Nu tijdelijk van € 6,50 voor € 5,50";
  assert.equal(
    assessCopywriterCompleteness(buildCopywriterSourceSnapshot(missingPromotion)).status,
    "COMPLETE",
  );
});

test("completeness is deterministic and does not mutate its snapshot", () => {
  const snapshot = buildCopywriterSourceSnapshot(completeSource());
  const before = structuredClone(snapshot);
  const first = assessCopywriterCompleteness(snapshot);
  const second = assessCopywriterCompleteness(snapshot);
  assert.deepEqual(first, second);
  assert.deepEqual(snapshot, before);
});
