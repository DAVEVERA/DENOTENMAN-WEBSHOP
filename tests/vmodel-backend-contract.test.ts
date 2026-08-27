import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const service = readFileSync(join(process.cwd(), "lib/design-studio/vmodel-service.ts"), "utf8");
const createRoute = readFileSync(join(process.cwd(), "app/api/admin/design-studio/vmodel/jobs/route.ts"), "utf8");
const statusRoute = readFileSync(join(process.cwd(), "app/api/admin/design-studio/vmodel/jobs/[jobId]/route.ts"), "utf8");

test("VModel jobs are provider-scoped, idempotent, limited and finalized under a lock", () => {
  assert.match(service, /existing\.provider !== "VMODEL"/);
  assert.match(service, /consumeDesignProviderAttempt\(job\.id, "VMODEL"/);
  assert.match(service, /providerRequestId: task\.providerTaskId/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /studio\/vmodel\/\$\{safeDesignId\(job\.id\)\}\.webp/);
  assert.match(service, /entityType: "DesignAsset"/);
  assert.match(service, /error instanceof VModelError && error\.retryable/);
});

test("VModel routes enforce admin authorization, same-origin mutation and no-store responses", () => {
  assert.match(createRoute, /getAdminSession/);
  assert.match(createRoute, /hasSameOrigin/);
  assert.match(createRoute, /validIdempotencyKey/);
  assert.match(createRoute, /status: result\.replayed \? 200 : 202/);
  assert.match(createRoute, /Cache-Control": "no-store"/);
  assert.match(statusRoute, /getAdminSession/);
  assert.match(statusRoute, /refreshVModelCampaignJob/);
  assert.match(statusRoute, /Cache-Control": "no-store"/);
});
