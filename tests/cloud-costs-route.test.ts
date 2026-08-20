import assert from "node:assert/strict";
import test from "node:test";
import { createCloudCostsGetHandler } from "../lib/cloud-costs-route";

test("cloud costs API rejects unauthenticated requests before loading billing data", async () => {
  let loaded = false;
  const handler = createCloudCostsGetHandler({
    authenticate: async () => false,
    loadCosts: async () => {
      loaded = true;
      throw new Error("should not run");
    },
  });

  const response = await handler(new Request("http://localhost/api/admin/cloud-costs?days=30"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  assert.equal(loaded, false);
});

test("cloud costs API returns the selected supported period", async () => {
  const handler = createCloudCostsGetHandler({
    authenticate: async () => true,
    loadCosts: async (days) => ({ days }),
  });

  const response = await handler(new Request("http://localhost/api/admin/cloud-costs?days=90"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { days: 90 });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("cloud costs API exposes safe setup and availability errors", async () => {
  const handler = createCloudCostsGetHandler({
    authenticate: async () => true,
    loadCosts: async () => {
      const error = new Error("secret provider detail") as Error & { code: string };
      error.code = "BILLING_EXPORT_NOT_CONFIGURED";
      throw error;
    },
  });

  const response = await handler(new Request("http://localhost/api/admin/cloud-costs"));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "BILLING_EXPORT_NOT_CONFIGURED" });
});
