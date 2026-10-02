import assert from "node:assert/strict";
import test from "node:test";

import { geminiModelChain, withGeminiModelFallback } from "../lib/gemini-fallback";

const busy = (status: number) => Object.assign(new Error("busy"), { status });
const noSleep = async () => {};

test("the model chain starts with the primary model and can be configured", () => {
  assert.deepEqual(geminiModelChain("gemini-3.6-flash", undefined), ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"]);
  assert.deepEqual(geminiModelChain("a", "b, a ,c"), ["a", "b", "c"]);
});

test("a busy model hands over to the next one", async () => {
  const tried: string[] = [];
  const { result, model } = await withGeminiModelFallback("a", async (name) => {
    tried.push(name);
    if (name === "a") throw busy(503);
    return "ok";
  }, { sleep: noSleep });
  assert.equal(result, "ok");
  assert.equal(model, "gemini-3.5-flash");
  assert.deepEqual(tried, ["a", "gemini-3.5-flash"]);
});

test("the chain is tried again after a pause, then the last error is thrown", async () => {
  let calls = 0;
  const pauses: number[] = [];
  await assert.rejects(
    withGeminiModelFallback("a", async () => { calls += 1; throw busy(429); }, { sleep: async (ms) => { pauses.push(ms); }, pauseMs: 5 }),
    (error: unknown) => (error as { status?: number }).status === 429,
  );
  assert.equal(calls, 8);
  assert.deepEqual(pauses, [5]);
});

test("a real error is not retried, a retired fallback model is skipped", async () => {
  let calls = 0;
  await assert.rejects(withGeminiModelFallback("a", async () => { calls += 1; throw busy(400); }, { sleep: noSleep }));
  assert.equal(calls, 1);
  const { model } = await withGeminiModelFallback("a", async (name) => {
    if (name === "a") throw busy(503);
    if (name === "gemini-3.5-flash") throw busy(404);
    return "ok";
  }, { sleep: noSleep });
  assert.equal(model, "gemini-3.8-flash");
});

test("no new model is started once the time budget is spent", async () => {
  let calls = 0;
  await assert.rejects(withGeminiModelFallback("a", async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    throw busy(503);
  }, { budgetMs: 10, sleep: noSleep }));
  assert.equal(calls, 1);
});
