import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  COOKIE_CONSENT_KNOWN_ATTRIBUTE,
  COOKIE_CONSENT_LIFETIME_DAYS,
  createCookieConsent,
  parseCookieConsent,
} from "../lib/cookie-consent";
import { COOKIE_CONSENT_BOOTSTRAP_SCRIPT } from "../lib/cookie-consent-bootstrap";
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

test("bootstrap hides the server-rendered banner only for current valid consent", () => {
  const now = new Date();
  const valid = createCookieConsent({ analytics: false, marketing: false }, now);
  const attributes = new Map<string, string>();

  runInNewContext(COOKIE_CONSENT_BOOTSTRAP_SCRIPT, {
    window: { localStorage: { getItem: () => JSON.stringify(valid) } },
    document: { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } },
  });

  assert.equal(attributes.get(COOKIE_CONSENT_KNOWN_ATTRIBUTE), "true");

  attributes.clear();
  const expired = createCookieConsent(
    { analytics: true, marketing: true },
    new Date("2025-01-01T00:00:00.000Z"),
  );
  runInNewContext(COOKIE_CONSENT_BOOTSTRAP_SCRIPT, {
    window: { localStorage: { getItem: () => JSON.stringify(expired) } },
    document: { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } },
  });

  assert.equal(attributes.has(COOKIE_CONSENT_KNOWN_ATTRIBUTE), false);
});

test("the consent banner is in server markup while optional scripts remain gated", async () => {
  const [layout, component] = await Promise.all([
    readFile("app/[locale]/layout.tsx", "utf8"),
    readFile("components/privacy/CookieConsent.tsx", "utf8"),
  ]);
  assert.match(layout, /import Script from "next\/script"/);
  assert.match(layout, /<Script\s+id="cookie-consent-bootstrap"\s+strategy="beforeInteractive"\s+dangerouslySetInnerHTML=\{\{ __html: COOKIE_CONSENT_BOOTSTRAP_SCRIPT \}\}/);
  assert.doesNotMatch(layout, /<script[^>]*COOKIE_CONSENT_BOOTSTRAP_SCRIPT/);
  assert.match(component, /const \[open, setOpen\] = useState\(true\)/);
  assert.match(component, /data-cookie-consent-banner/);
  assert.doesNotMatch(component, /\[ready, setReady\]|ready && open/);
  assert.match(component, /consent\?\.analytics[\s\S]*?<GoogleAnalytics/);
  assert.match(component, /consent\?\.marketing[\s\S]*?mailchimp-connected-site/);
});
