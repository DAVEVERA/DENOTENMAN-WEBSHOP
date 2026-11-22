import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAiVisibilityQuality } from "../lib/ai-vindbaarheid/dashboard-metrics";

test("no measurements are explicitly unavailable rather than fake zero scores", () => {
  const result = summarizeAiVisibilityQuality(10, []);
  assert.equal(result.coveragePercent, 0);
  assert.equal(result.qualityScore, null);
  assert.equal(result.completenessPercent, null);
  assert.equal(result.openFindings, null);
  assert.equal(result.measuredAt, null);
});

test("metrics retain denominator and most recent measurement for each product", () => {
  const result = summarizeAiVisibilityQuality(4, [
    { productId: "a", measuredAt: "2026-11-20T10:00:00Z", overallScore: 10, requiredFields: 10, filledFields: 2, localesComplete: 1, localesExpected: 3, openFindings: 9 },
    { productId: "a", measuredAt: "2026-11-21T10:00:00Z", overallScore: 80, requiredFields: 10, filledFields: 8, localesComplete: 2, localesExpected: 3, openFindings: 2 },
    { productId: "b", measuredAt: "2026-11-21T11:00:00Z", overallScore: 60, requiredFields: 5, filledFields: 3, localesComplete: 3, localesExpected: 3, openFindings: 1 },
  ]);
  assert.equal(result.auditedProducts, 2);
  assert.equal(result.coveragePercent, 50);
  assert.equal(result.qualityScore, 70);
  assert.equal(result.completenessPercent, 73);
  assert.equal(result.languageCoveragePercent, 83);
  assert.equal(result.openFindings, 3);
  assert.equal(result.measuredAt, "2026-11-21T11:00:00Z");
});
