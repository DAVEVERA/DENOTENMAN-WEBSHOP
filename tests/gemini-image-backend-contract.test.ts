import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const service = readFileSync(join(process.cwd(), "lib/design-studio/gemini-image-service.ts"), "utf8");
const createRoute = readFileSync(join(process.cwd(), "app/api/admin/design-studio/gemini-image/jobs/route.ts"), "utf8");
const statusRoute = readFileSync(join(process.cwd(), "app/api/admin/design-studio/gemini-image/status/route.ts"), "utf8");

test("Gemini jobs are provider-scoped, idempotent, limited and stored as drafts", () => {
  assert.match(service, /existing\.provider !== "GEMINI"/);
  assert.match(service, /provider: "GEMINI"/);
  assert.match(service, /consumeDesignProviderAttempt\(job\.id, "GEMINI"/);
  assert.match(service, /studio\/gemini/);
  assert.match(service, /status: "DRAFT"/);
  assert.match(service, /entityType: "DesignAsset"/);
  assert.match(service, /releaseDesignProviderAttempt\(job\.id, "GEMINI"/);
});

test("Gemini routes enforce admin authorization, same-origin mutation and no-store responses", () => {
  assert.match(createRoute, /getAdminSession/);
  assert.match(createRoute, /hasSameOrigin/);
  assert.match(createRoute, /validIdempotencyKey/);
  assert.match(createRoute, /geminiImageJobSchema/);
  assert.match(createRoute, /Cache-Control": "no-store"/);
  assert.match(statusRoute, /getAdminSession/);
  assert.match(statusRoute, /getGeminiImageAvailability/);
  assert.match(statusRoute, /Cache-Control": "no-store"/);
});
