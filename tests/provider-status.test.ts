import assert from "node:assert/strict";
import test from "node:test";
import { buildProviderStatuses } from "../lib/provider-status-core";

const checkedAt = "2026-10-04T10:00:00.000Z";

test("integration health exposes the stable read-only contract without secret values", () => {
  const statuses = buildProviderStatuses({
    environment: {
      MOLLIE_API_KEY: "live_secret_must_not_leak",
      POSTNL_API_KEY: "postnl_secret_must_not_leak",
      GCS_BUCKET: "private-bucket-name",
      PHOTOROOM_API_KEY: "photoroom_secret_must_not_leak",
    },
    settings: {},
    photoRoom: {
      status: "invalid_configuration",
      availableCredits: null,
      requiredCredits: null,
    },
    socialAccounts: [],
  }, checkedAt);

  for (const health of statuses) {
    assert.equal(typeof health.configured, "boolean");
    assert.equal(health.status, health.state);
    assert.equal(health.lastCheckedAt, checkedAt);
  }

  const serialized = JSON.stringify(statuses);
  assert.doesNotMatch(serialized, /live_secret_must_not_leak|postnl_secret_must_not_leak|private-bucket-name|photoroom_secret_must_not_leak/u);
});
test("PhotoRoom authentication ambiguity never claims that credits are exhausted", () => {
  const photoRoom = buildProviderStatuses({
    environment: { PHOTOROOM_API_KEY: "configured" },
    settings: {},
    photoRoom: {
      status: "invalid_configuration",
      availableCredits: null,
      requiredCredits: null,
    },
    socialAccounts: [],
  }, checkedAt).find((health) => health.id === "photoroom");

  assert.ok(photoRoom);
  assert.equal(photoRoom.status, "attention");
  assert.equal(photoRoom.evidence, "provider");
  assert.doesNotMatch(photoRoom.summary, /tegoed (?:is )?op|0 credits/iu);
});

test("PhotoRoom reports exhausted credits only from a numeric provider balance", () => {
  const photoRoom = buildProviderStatuses({
    environment: { PHOTOROOM_API_KEY: "configured" },
    settings: {},
    photoRoom: {
      status: "insufficient_credits",
      availableCredits: 0,
      requiredCredits: 5,
    },
    socialAccounts: [],
  }, checkedAt).find((health) => health.id === "photoroom");

  assert.ok(photoRoom);
  assert.equal(photoRoom.status, "blocked");
  assert.match(photoRoom.summary, /0 credits/u);
});
