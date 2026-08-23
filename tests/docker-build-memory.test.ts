import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("raises the Node heap only for the Docker build stage", () => {
  const source = readFileSync("Dockerfile", "utf8");
  const builderStage = source.indexOf("FROM base AS builder");
  const heapSetting = source.indexOf("ENV NODE_OPTIONS=--max-old-space-size=4096");
  const applicationBuild = source.indexOf("RUN npm run build");
  const runnerStage = source.indexOf("FROM base AS runner");

  assert.ok(builderStage >= 0);
  assert.ok(heapSetting > builderStage);
  assert.ok(applicationBuild > heapSetting);
  assert.ok(runnerStage > applicationBuild);
  assert.doesNotMatch(source.slice(runnerStage), /NODE_OPTIONS/);
});
