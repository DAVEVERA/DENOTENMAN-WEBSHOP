import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  createDeveloperSessionToken,
  resetDeveloperLoginAttempts,
  verifyDeveloperCredentials,
  verifyDeveloperSessionToken,
} from "../lib/developer-portal/auth";
import { openSecret, sealSecret } from "../lib/developer-portal/secret-box";
import { looksLikeStripeSecretKey } from "../lib/developer-portal/stripe";
import { hashPassword } from "../lib/pbkdf2-password";

const previous = { secret: process.env.ADMIN_SESSION_SECRET, hash: process.env.DEVELOPER_PORTAL_PASSWORD_HASH };

before(async () => {
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-for-developer-portal";
  process.env.DEVELOPER_PORTAL_PASSWORD_HASH = await hashPassword("juist-wachtwoord-123");
  resetDeveloperLoginAttempts();
});

after(() => {
  process.env.ADMIN_SESSION_SECRET = previous.secret;
  process.env.DEVELOPER_PORTAL_PASSWORD_HASH = previous.hash;
});

test("a developer session is bound to the admin that opened it and expires", () => {
  const now = Date.parse("2026-09-30T10:00:00Z");
  const token = createDeveloperSessionToken("admin_1", now);
  assert.equal(verifyDeveloperSessionToken(token, "admin_1", now + 60_000), true);
  assert.equal(verifyDeveloperSessionToken(token, "admin_2", now + 60_000), false, "another admin cannot use it");
  assert.equal(verifyDeveloperSessionToken(token, "admin_1", now + 9 * 60 * 60 * 1000), false, "expires after 8 hours");
  const tampered = token.replace("admin_1", "admin_2");
  assert.equal(verifyDeveloperSessionToken(tampered, "admin_2", now), false, "signature covers the admin id");
  assert.equal(verifyDeveloperSessionToken(undefined, "admin_1", now), false);
});

test("only the developer credentials open the portal, and repeated failures lock it", async () => {
  assert.equal(await verifyDeveloperCredentials("MNRV", "juist-wachtwoord-123", "ip-a"), "OK");
  assert.equal(await verifyDeveloperCredentials("mnrv", "juist-wachtwoord-123", "ip-a"), "OK", "username is case-insensitive");
  assert.equal(await verifyDeveloperCredentials("fedor", "juist-wachtwoord-123", "ip-a"), "INVALID");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await verifyDeveloperCredentials("MNRV", "fout", "ip-b"), "INVALID");
  }
  assert.equal(await verifyDeveloperCredentials("MNRV", "juist-wachtwoord-123", "ip-b"), "LOCKED", "even the right password is refused while locked");
  assert.equal(await verifyDeveloperCredentials("MNRV", "juist-wachtwoord-123", "ip-c"), "OK", "other addresses are not affected");
});

test("without a configured password hash the portal stays closed", async () => {
  const hash = process.env.DEVELOPER_PORTAL_PASSWORD_HASH;
  delete process.env.DEVELOPER_PORTAL_PASSWORD_HASH;
  try {
    assert.equal(await verifyDeveloperCredentials("MNRV", "wat-dan-ook", "ip-d"), "NOT_CONFIGURED");
  } finally {
    process.env.DEVELOPER_PORTAL_PASSWORD_HASH = hash;
  }
});

test("payment secrets are encrypted at rest and tampering is detected", () => {
  const sealed = sealSecret("rk_live_abcdefghijklmnop1234");
  assert.doesNotMatch(sealed, /rk_live/u);
  assert.equal(openSecret(sealed), "rk_live_abcdefghijklmnop1234");
  const parts = sealed.split(".");
  parts[3] = `${parts[3].slice(0, -2)}AA`;
  assert.equal(openSecret(parts.join(".")), null);
  assert.equal(openSecret(null), null);
});

test("only Stripe secret and restricted keys are accepted", () => {
  assert.equal(looksLikeStripeSecretKey("sk_test_51AbCdEfGhIjKlMnOp"), true);
  assert.equal(looksLikeStripeSecretKey("rk_live_51AbCdEfGhIjKlMnOp"), true);
  assert.equal(looksLikeStripeSecretKey("pk_live_51AbCdEfGhIjKlMnOp"), false, "publishable keys cannot create payments");
  assert.equal(looksLikeStripeSecretKey("whsec_123"), false);
});

test("the password hash may use colons, which survive .env variable expansion", async () => {
  const hash = process.env.DEVELOPER_PORTAL_PASSWORD_HASH!;
  process.env.DEVELOPER_PORTAL_PASSWORD_HASH = hash.split("$").join(":");
  try {
    resetDeveloperLoginAttempts();
    assert.equal(await verifyDeveloperCredentials("MNRV", "juist-wachtwoord-123", "ip-e"), "OK");
  } finally {
    process.env.DEVELOPER_PORTAL_PASSWORD_HASH = hash;
  }
});
