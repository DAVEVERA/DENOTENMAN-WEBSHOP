import assert from "node:assert/strict";
import test from "node:test";
import { planFactReconciliation } from "../lib/ai-vindbaarheid/fact-reconciliation";

const base = {
  productId: "p1", variantId: "v1", kind: "ingredients" as const,
  translations: [
    { locale: "nl" as const, value: null },
    { locale: "en" as const, value: "almonds" },
    { locale: "fr" as const, value: null },
  ],
};

test("different language coverage cannot become product truth without verified evidence", () => {
  const result = planFactReconciliation({ ...base, evidence: [] });
  assert.equal(result.action, "research_online");
  assert.equal(result.verifiedSource, null);
  assert.deepEqual(result.missingLocales, ["nl", "fr"]);
});

test("verified evidence from wrong product variant is rejected", () => {
  const result = planFactReconciliation({
    ...base, evidence: [{ sourceId: "other", verified: true, value: "almonds", variantId: "v2" }],
  });
  assert.equal(result.action, "research_online");
});

test("conflicting verified sources require manual review", () => {
  const result = planFactReconciliation({
    ...base, evidence: [
      { sourceId: "supplier-1", verified: true, value: "almonds", variantId: "v1" },
      { sourceId: "supplier-2", verified: true, value: "almonds, salt", variantId: "v1" },
    ],
  });
  assert.equal(result.action, "verify_source");
  assert.equal(result.verifiedSource, null);
});

test("verified source authorizes translation proposal but never publishing", () => {
  const result = planFactReconciliation({
    ...base, evidence: [{ sourceId: "supplier-verified", verified: true, value: "100% amandelen", variantId: "v1" }],
  });
  assert.equal(result.action, "translate_verified_source");
  assert.equal(result.verifiedSource?.sourceId, "supplier-verified");
  assert.equal(result.requiresApproval, true);
});

test("all languages missing still cannot trigger factual invention", () => {
  const result = planFactReconciliation({
    ...base, translations: [], evidence: [],
  });
  assert.deepEqual(result.missingLocales, ["nl", "en", "fr"]);
  assert.equal(result.action, "research_online");
});
