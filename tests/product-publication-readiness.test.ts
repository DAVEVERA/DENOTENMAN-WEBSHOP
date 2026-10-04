import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicationReadiness,
  publicationReadinessRegressed,
  publicationBlockedContract,
} from "../lib/product-publication-readiness";

test("publication readiness reports every required storefront field", () => {
  const result = getPublicationReadiness({
    nlName: " ",
    nlSlug: "Cassata Gemengde Vruchten",
    variants: [{ isActive: false, priceCents: 495, salePriceCents: null }],
    activeCategoryCount: 0,
    hasPrimaryImage: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    [
      "NL_NAME_REQUIRED",
      "NL_SLUG_INVALID",
      "ACTIVE_VARIANT_WITH_PRICE_REQUIRED",
      "ACTIVE_CATEGORY_REQUIRED",
      "PRIMARY_IMAGE_REQUIRED",
    ],
  );
});

test("an online legacy product may be edited only when readiness does not get worse", () => {
  const legacy = getPublicationReadiness({
    nlName: "Legacy product",
    nlSlug: "legacy-product",
    variants: [{ isActive: true, priceCents: 500, salePriceCents: null }],
    activeCategoryCount: 1,
    hasPrimaryImage: false,
  });
  const harmlessEdit = getPublicationReadiness({
    nlName: "Legacy product verbeterd",
    nlSlug: "legacy-product",
    variants: [{ isActive: true, priceCents: 500, salePriceCents: null }],
    activeCategoryCount: 1,
    hasPrimaryImage: false,
  });
  const worsened = getPublicationReadiness({
    nlName: "Legacy product verbeterd",
    nlSlug: "legacy-product",
    variants: [{ isActive: false, priceCents: 0, salePriceCents: null }],
    activeCategoryCount: 1,
    hasPrimaryImage: false,
  });

  assert.equal(publicationReadinessRegressed(legacy, harmlessEdit), false);
  assert.equal(publicationReadinessRegressed(legacy, worsened), true);
});

test("Cassata can be published with zero stock when its active variant has a positive effective price", () => {
  const cassataVariant = {
    isActive: true,
    priceCents: 495,
    salePriceCents: null,
    stock: 0,
  };
  const result = getPublicationReadiness({
    nlName: "Cassata gemengde vruchten",
    nlSlug: "cassata-gemengde-vruchten",
    variants: [cassataVariant],
    activeCategoryCount: 1,
    hasPrimaryImage: true,
  });

  assert.deepEqual(result, { ready: true, issues: [] });
});

test("the effective sale price, not stock or the crossed-out price, controls publication", () => {
  const result = getPublicationReadiness({
    nlName: "Cassata gemengde vruchten",
    nlSlug: "cassata-gemengde-vruchten",
    variants: [{ isActive: true, priceCents: 495, salePriceCents: 0 }],
    activeCategoryCount: 1,
    hasPrimaryImage: true,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["ACTIVE_VARIANT_WITH_PRICE_REQUIRED"]);
});

test("publication failures use the structured PUBLICATION_BLOCKED contract", () => {
  const issues = getPublicationReadiness({
    nlName: "Cassata gemengde vruchten",
    nlSlug: "cassata-gemengde-vruchten",
    variants: [],
    activeCategoryCount: 1,
    hasPrimaryImage: true,
  }).issues;

  assert.deepEqual(publicationBlockedContract(issues), {
    status: 422,
    body: {
      error: "PUBLICATION_BLOCKED",
      message: "Dit product kan nog niet online worden gezet.",
      issues,
    },
  });
});
