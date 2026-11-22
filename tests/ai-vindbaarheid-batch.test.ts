import assert from "node:assert/strict";
import test from "node:test";
import { runBatchAudit } from "../lib/ai-vindbaarheid/batch-audit";

const sample = (id: string) => ({
  id, sku: id, name: "Amandelen",
  targets: [{ locale: "nl" as const, path: `/nl/producten/${id}`, productName: "Amandelen" }],
});

test("batch audit returns separate product results and failed check findings", async () => {
  const requested: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    requested.push(String(url));
    return new Response('<html><head><title>Amandelen</title></head><body><h1>Amandelen</h1></body></html>', { status: 200 });
  };
  const result = await runBatchAudit([sample("first"), sample("second")], {
    baseUrl: "https://denotenman.com", fetcher, concurrency: 1,
  });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.id), ["first", "second"]);
  assert.equal(requested.length, 2);
  assert.ok(result.every((item) => item.findings.length > 0));
  assert.ok(result.every((item) => item.pages.length === 1));
});

test("batch audit keeps failed HTTP fetch scoped to the affected product", async () => {
  const fetcher: typeof fetch = async (url) => {
    if (String(url).includes("first")) throw new Error("offline");
    return new Response("<html></html>", { status: 200 });
  };
  const result = await runBatchAudit([sample("first"), sample("second")], {
    baseUrl: "https://denotenman.com", fetcher,
  });
  assert.equal(result[0].pages[0].status, 0);
  assert.equal(result[1].pages[0].status, 200);
});
