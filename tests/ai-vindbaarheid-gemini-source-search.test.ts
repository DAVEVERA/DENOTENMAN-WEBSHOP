import assert from "node:assert/strict";
import test from "node:test";
import { searchProductSources } from "../lib/ai-vindbaarheid/gemini-source-search";

const target = {
  productId: "p1", variantId: "v1", sku: "AM-250",
  productName: "Gebrande amandelen", weightGrams: 250, field: "ingredients" as const,
};

test("Gemini key missing produces configuration state without a call", async () => {
  const result = await searchProductSources(target, {
    apiKey: "",
    generate: async () => { throw new Error("Should not call model"); },
  });
  assert.equal(result.status, "not_configured");
});

test("Gemini grounding returns only URL citations, never AI prose as facts", async () => {
  let calls = 0;
  const result = await searchProductSources(target, {
    apiKey: "fake-test-key",
    clock: () => new Date("2026-11-22T00:00:00Z"),
    generate: async (request) => {
      calls++;
      assert.deepEqual(request.config.tools, [{ googleSearch: {} }]);
      return {
        candidates: [{
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.com/AM-250", title: "Gebrande amandelen AM-250" } },
              { web: { uri: "https://example.com/AM-250", title: "Duplicate" } },
              { web: { uri: "javascript:alert(1)", title: "Invalid" } },
              { web: { uri: "http://example.com/insecure", title: "Insecure" } },
            ],
          },
        }],
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "complete");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].sourceType, "unknown");
  assert.equal(result.candidates[0].needsManualVerification, true);
  assert.equal(result.candidates[0].exactSkuMentioned, true);
});

test("Gemini without supporting grounding links cannot claim verified sources", async () => {
  const result = await searchProductSources(target, {
    apiKey: "fake-test-key",
    generate: async () => ({ candidates: [{ groundingMetadata: { webSearchQueries: ["AM-250"] } }] }),
  });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.candidates, []);
});

test("Gemini provider error is represented as unresolved research", async () => {
  const result = await searchProductSources(target, {
    apiKey: "fake-test-key",
    generate: async () => { throw new Error("Provider error"); },
  });
  assert.equal(result.status, "partial");
  assert.equal(result.failures, 1);
});
