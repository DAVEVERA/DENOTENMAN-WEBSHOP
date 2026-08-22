import assert from "node:assert/strict";
import test from "node:test";
import {
  COOKIE_CONSENT_LIFETIME_DAYS,
  createCookieConsent,
  parseCookieConsent,
} from "../lib/cookie-consent";
test("cookie consent expires and keeps optional categories off by explicit choice", () => {
  const now = new Date("2026-08-21T10:00:00.000Z");
  const consent = createCookieConsent({ analytics: false, marketing: false }, now);

  assert.equal(consent.necessary, true);
  assert.equal(consent.analytics, false);
  assert.equal(consent.marketing, false);
  assert.equal(
    Date.parse(consent.expiresAt) - now.getTime(),
    COOKIE_CONSENT_LIFETIME_DAYS * 24 * 60 * 60 * 1000
  );
  assert.deepEqual(parseCookieConsent(JSON.stringify(consent), now), consent);
});

test("expired, malformed and old consent records are rejected", () => {
  const now = new Date("2026-08-21T10:00:00.000Z");
  const expired = createCookieConsent(
    { analytics: true, marketing: true },
    new Date("2025-01-01T00:00:00.000Z")
  );

  assert.equal(parseCookieConsent(JSON.stringify(expired), now), null);
  assert.equal(parseCookieConsent("not-json", now), null);
  assert.equal(parseCookieConsent(JSON.stringify({ ...expired, version: 0 }), now), null);
});
