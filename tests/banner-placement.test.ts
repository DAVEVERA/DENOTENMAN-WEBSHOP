import assert from "node:assert/strict";
import test from "node:test";
import { bannerMatchesPath } from "../lib/marketing/banner-placement";

test("campaign banners appear only on their intended storefront pages", () => {
  assert.equal(bannerMatchesPath("PAGE", "/nl/products/amandelen", "/nl/products/amandelen"), true);
  assert.equal(bannerMatchesPath("PAGE", "/nl/products/amandelen", "/nl/products/pecannoten"), false);
  assert.equal(bannerMatchesPath("HOMEPAGE", null, "/nl"), true);
  assert.equal(bannerMatchesPath("HOMEPAGE", null, "/nl/cart"), false);
  assert.equal(bannerMatchesPath("CATEGORY", null, "/fr/categories/noix"), true);
});
