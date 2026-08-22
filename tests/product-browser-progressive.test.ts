import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage progressively fetches bounded server-side catalog pages", () => {
  const browser = readFileSync("components/product/ProductBrowser.tsx", "utf8");
  const page = readFileSync("app/[locale]/page.tsx", "utf8");
  const queries = readFileSync("lib/queries.ts", "utf8");
  const route = readFileSync("app/api/storefront/catalog/route.ts", "utf8");

  assert.match(page, /getCatalogProducts\(locale,/);
  assert.doesNotMatch(page, /getFilteredProducts\("all"[\s\S]*limit:\s*300/);
  assert.match(queries, /catalogPageSize\s*=\s*24/);
  assert.match(queries, /Math\.min\(Math\.max\(request\.limit[\s\S]*catalogPageSize\)/);
  assert.match(route, /offset/);
  assert.match(route, /normalizeCatalogSort/);
  assert.match(browser, /\/api\/storefront\/catalog/);
  assert.match(browser, /SORT_PARAM/);
  assert.match(browser, /catalogApiUrl\(locale, query, selected, sort, products\.length\)/);
  assert.match(browser, /value="PRICE_ASC"/);
  assert.match(browser, /value="PRICE_DESC"/);
  assert.match(browser, /value="POPULAR"/);
  assert.match(browser, /value="BEST_SELLING"/);
  assert.match(browser, /value="MOST_VIEWED"/);
  assert.match(queries, /activeVariantFacets/);
  assert.match(queries, /availableVariantFilters/);
  assert.match(browser, /availableVariantFilters\.has\(value\) \|\| selected\.has\(value\)/);
  assert.match(browser, /products\.length/);
  assert.match(browser, /copy\.loadMore/);
});

test("homepage quick view is shared and fetches variant data only on demand", () => {
  const browser = readFileSync("components/product/ProductBrowser.tsx", "utf8");
  const card = readFileSync("components/product/ProductCard.tsx", "utf8");

  assert.match(browser, /\/api\/storefront\/products\//);
  assert.equal((browser.match(/<ProductQuickView/g) ?? []).length, 1);
  assert.match(card, /!onQuickView && "variants" in product/);
  assert.doesNotMatch(card, /@\/dictionaries\//);
  assert.doesNotMatch(browser, /@\/dictionaries\//);
});

test("catalog controls retain 44px touch targets and mobile overflow guards", () => {
  const browser = readFileSync("components/product/ProductBrowser.tsx", "utf8");
  assert.match(browser, /min-h-11 max-w-full rounded-button/);
  assert.match(browser, /className="h-11 w-full min-w-0 rounded-button/);
  assert.match(browser, /overflow-y-auto overflow-x-hidden/);
  assert.match(browser, /grid min-w-0 grid-cols-2/);
  assert.match(browser, /role="dialog"/);
  assert.match(browser, /aria-modal="true"/);
  assert.match(browser, /filterCloseRef\.current\?\.focus/);
  assert.match(browser, /event\.shiftKey && document\.activeElement === first/);
  assert.match(browser, /filterTriggerRef\.current\?\.focus/);
});
