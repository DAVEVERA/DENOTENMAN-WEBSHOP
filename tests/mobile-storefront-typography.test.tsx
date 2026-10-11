import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const featured = readFileSync("components/home/HomeFeaturedProducts.tsx", "utf8");
const productCard = readFileSync("components/product/ProductCard.tsx", "utf8");
const productPrice = readFileSync("components/product/ProductPrice.tsx", "utf8");
const ticker = readFileSync("components/home/AnnouncementTicker.tsx", "utf8");
const categoryTile = readFileSync("components/category/CategoryTile.tsx", "utf8");
const usp = readFileSync("components/ui/USPBar.tsx", "utf8");

test("featured products keep readable cards across phone and tablet widths", () => {
  assert.match(featured, /grid-cols-1/);
  assert.match(featured, /min-\[380px\]:grid-cols-2/);
  assert.match(featured, /md:grid-cols-3/);
  assert.match(featured, /lg:grid-cols-4/);
  assert.match(featured, /xl:grid-cols-6/);
  assert.match(featured, /hidden md:block/);
  assert.match(featured, /md:hidden/);
});

test("product card copy no longer drops below fourteen pixels", () => {
  assert.match(productCard, /line-clamp-3 text-base sm:text-lg/);
  assert.match(productCard, /min-h-12 w-full px-2 text-base/);
  assert.match(productCard, /font-heading text-sm font-bold/);
  assert.doesNotMatch(productCard, /max-\[420px\]:text-xs/);
  assert.doesNotMatch(productCard, /text-xs/);
  assert.match(productPrice, /text-base font-semibold text-text sm:text-lg/);
});

test("supporting homepage copy uses a readable mobile scale", () => {
  assert.match(ticker, /font-heading text-sm/);
  assert.match(categoryTile, /font-heading text-base font-bold/);
  assert.match(usp, /text-base leading-6/);
});
