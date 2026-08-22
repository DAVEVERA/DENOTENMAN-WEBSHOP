import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("product view tracking is aggregate-only, consent-gated and session-deduplicated", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260823010000_add_product_view_count/migration.sql",
    "utf8"
  );
  const tracker = readFileSync("components/product/ProductViewTracker.tsx", "utf8");
  const metrics = readFileSync("lib/product-metrics.ts", "utf8");
  const queries = readFileSync("lib/queries.ts", "utf8");
  const route = readFileSync("app/api/storefront/products/[id]/view/route.ts", "utf8");
  const consent = readFileSync("components/privacy/CookieConsent.tsx", "utf8");
  const consentHelper = readFileSync("lib/product-view-consent.ts", "utf8");

  assert.match(schema, /model ProductViewMetric[\s\S]*viewCount\s+Int\s+@default\(0\)/);
  assert.match(migration, /CREATE TABLE "ProductViewMetric"/);
  assert.doesNotMatch(migration, /"(?:visitor|ipAddress|userAgent|sessionId)"/i);
  assert.match(tracker, /consent\?\.analytics/);
  assert.match(tracker, /window\.sessionStorage/);
  assert.match(tracker, /COOKIE_CONSENT_EVENT/);
  assert.match(metrics, /viewCount: \{ increment: 1 \}/);
  assert.match(metrics, /where: \{ id: productId, isActive: true \}/);
  assert.match(metrics, /productViewMinimumIntervalMs = 2_000/);
  assert.match(metrics, /updatedAt: \{ lte: cutoff \}/);
  assert.match(metrics, /error\.code === "P2002"/);
  assert.match(route, /origin === new URL\(request\.url\)\.origin/);
  assert.match(route, /fetchSite === "same-origin"/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: recorded \? 204 : 404/);
  assert.match(queries, /PrismaClientKnownRequestError/);
  assert.match(queries, /error\.code === "P2021"/);
  assert.match(consent, /consent\?\.analytics && !nextAnalytics/);
  assert.match(consent, /clearProductViewSessionStorage\(window\.sessionStorage\)/);
  assert.match(consentHelper, /startsWith\(PRODUCT_VIEW_SESSION_KEY_PREFIX\)/);
});
