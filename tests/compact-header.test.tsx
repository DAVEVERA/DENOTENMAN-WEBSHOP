import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compactHeader = readFileSync("components/layout/CompactHeader.tsx", "utf8");
const header = readFileSync("components/layout/Header.tsx", "utf8");

test("the production header uses the compact live-navigation component", () => {
  assert.match(header, /getCategoryNavigation\(locale\)/);
  assert.match(header, /<CompactHeader/);
  assert.match(header, /categories=\{navigation\.categories\}/);
  assert.doesNotMatch(header, /MegaMenu|MobileNav|HeaderActions/);
});

test("the compact header preserves approved storefront behavior", () => {
  assert.match(compactHeader, /categoryHref\(locale, category\)/);
  assert.match(compactHeader, /<NavbarSearch/);
  assert.match(compactHeader, /useStorefrontState\(\)/);
  assert.match(compactHeader, /<LocaleSwitcher/);
  assert.doesNotMatch(compactHeader, /dictionary\.nav\.business|>Zakelijk</);
});

test("requested categories are prominent while baking remains under More", () => {
  assert.match(compactHeader, /rootBySlug\.get\("gedroogd-fruit"\)/);
  assert.match(compactHeader, /rootBySlug\.get\("muesli-granen"\)/);
  assert.match(compactHeader, /rootBySlug\.get\("snacks-zoutjes"\)/);
  assert.match(compactHeader, /canonicalSlug === "honing"/);
  assert.match(compactHeader, /canonicalSlug === "notenpasta-s"/);
  assert.match(compactHeader, /rootBySlug\.get\("bakproducten"\)/);
  assert.match(compactHeader, /category\.canonicalSlug !== "bakproducten"/);
  assert.match(compactHeader, /catalogSearchHref/);
  assert.match(compactHeader, /driedFruitSubcategories/);
  assert.match(compactHeader, /honeySubcategories/);
  assert.match(compactHeader, /nutButterSubcategories/);
});

test("parent links, disclosure controls and the mobile modal remain accessible", () => {
  assert.match(compactHeader, /aria-controls=\{`site-header-panel-\$\{category\.id\}`\}/);
  assert.match(compactHeader, /aria-expanded=\{isOpen\}/);
  assert.match(compactHeader, /role="dialog"/);
  assert.match(compactHeader, /aria-modal="true"/);
  assert.match(compactHeader, /event\.key === "Escape"/);
  assert.match(compactHeader, /event\.key !== "Tab"/);
  assert.match(compactHeader, /createPortal\(/);
  assert.match(compactHeader, /className="inline-flex min-h-11 min-w-0 items-center"/);
});
