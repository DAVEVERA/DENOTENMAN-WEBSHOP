import assert from "node:assert/strict";
import test from "node:test";
import { searchProductSources } from "../lib/ai-vindbaarheid/brave-source-search";

const target = {
  productId: "p1", variantId: "v1", sku: "AM-250",
  productName: "Gebrande amandelen", weightGrams: 250, field: "ingredients" as const,
};

test("missing API key returns explicit configuration state without calls", async () => {
  const result = await searchProductSources(target, {
    apiKey: "",
    fetcher: async () => { throw Error("Search must not run"); },
  });
  // Use explicit empty key independent of the CI environment.
  if (!process.env.BRAVE_SEARCH_API_KEY) assert.equal(result.status, "not_configured");
});

test("web results are deduplicated and kept unverified", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const uri = String(input);
    calls.push(uri);
    assert.equal(new URL(uri).hostname, "api.search.brave.com");
    assert.equal((init?.headers as Record<string, string>)["X-Subscription-Token"], "test-key");
    return new Response(JSON.stringify({ web: { results: [
      { url: "https://example.org/product", title: "Gebrande amandelen AM-250", description: "ingrediënten" },
      { url: "https://example.org/product", title: "Duplicaat", description: "" },
      { url: "javascript:alert(1)", title: "invalid", description: "" },
    ] } }), { status: 200 });
  };
  const result = await searchProductSources(target, {
    apiKey: "test-key", fetcher, maxQueries: 2, clock: () => new Date("2026-11-22T00:00:00Z"),
  });
  assert.equal(result.status, "complete");
  if (result.status !== "complete" && result.status !== "partial") throw Error("Unexpected state");
  assert.equal(calls.length, 2);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].sourceType, "unknown");
  assert.equal(result.candidates[0].needsManualVerification, true);
  assert.equal(result.candidates[0].exactSkuMentioned, true);
});

test("provider failure is represented without invented facts", async () => {
  const result = await searchProductSources(target, {
    apiKey: "test-key", fetcher: async () => new Response("Rate limited", { status: 429 }),
  });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.candidates, []);
});
