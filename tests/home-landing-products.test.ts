import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HOME_CATEGORY_ENTRANCES,
  HOME_CATEGORY_PREVIEW_SKUS,
} from "../lib/home-category-entrances";
import {
  HOME_HONEY_PRODUCT_SKUS,
  HOME_NUT_PRODUCT_SKUS,
} from "../lib/home-featured-products";

test("homepage category previews are curated and unique", () => {
  assert.equal(HOME_CATEGORY_ENTRANCES.length, 6);
  assert.equal(
    new Set(HOME_CATEGORY_ENTRANCES.map(({ canonicalSlug }) => canonicalSlug))
      .size,
    6,
  );
  assert.equal(
    new Set(HOME_CATEGORY_ENTRANCES.map(({ previewSku }) => previewSku)).size,
    6,
  );
  assert.deepEqual(
    HOME_CATEGORY_ENTRANCES.map(({ canonicalSlug }) => canonicalSlug),
    [
      "noten",
      "gedroogd-fruit",
      "chocolade-zoet",
      "pitten-zaden",
      "snacks-zoutjes",
      "bakproducten",
    ],
  );
  assert.equal(HOME_CATEGORY_PREVIEW_SKUS.noten, "MIX-3003-250-P");
  assert.equal(HOME_NUT_PRODUCT_SKUS.length, 6);
  assert.equal(new Set(HOME_NUT_PRODUCT_SKUS).size, 6);
  assert.equal(HOME_HONEY_PRODUCT_SKUS.length, 6);
  assert.equal(new Set(HOME_HONEY_PRODUCT_SKUS).size, 6);
});

test("homepage product query is bounded, taxonomy-aware and keeps every nut butter", async () => {
  const source = await readFile("lib/queries.ts", "utf8");

  assert.match(source, /export const getHomeLandingProducts = cache/);
  assert.match(source, /const HOME_PRODUCT_LIMIT = 6/);
  assert.match(source, /categoryIds\("noten"\)/);
  assert.match(source, /categoryIds\("honing"\)/);
  assert.match(source, /categoryIds\("notenpasta-s"\)/);
  assert.match(
    source,
    /findGroupIds\(honeyCategoryIds,[\s\S]*excludedCategoryIds: nutButterCategoryIds/,
  );
  assert.match(
    source,
    /findGroupIds\(nutCategoryIds, \{[\s\S]*limit: HOME_PRODUCT_LIMIT,[\s\S]*preferredSkus: HOME_NUT_PRODUCT_SKUS/,
  );
  assert.match(
    source,
    /findGroupIds\(nutButterCategoryIds\),/,
  );
  assert.match(source, /variants: \{ some: \{ isActive: true \} \}/);
  assert.doesNotMatch(source, /getHomeFeaturedProducts/);
});

test("homepage renders the requested alternating sequence and full nut-butter grid", async () => {
  const [page, section] = await Promise.all([
    readFile("app/[locale]/page.tsx", "utf8"),
    readFile("components/home/HomeFeaturedProducts.tsx", "utf8"),
  ]);
  const orderedMarkers = [
    "<HomeCraftStory",
    "products={homeProducts.nuts}",
    "<HomeHoneyStory",
    "products={homeProducts.honey}",
    "<HomeNutButterStory",
    "products={homeProducts.nutButters}",
  ];
  const positions = orderedMarkers.map((marker) => page.indexOf(marker));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.match(page, /sectionId="home-nut-butters"/);
  assert.match(page, /layout="grid"/);
  assert.match(section, /min-\[390px\]:grid-cols-2/);
  assert.match(section, /lg:grid-cols-3/);
  assert.match(section, /fullWidth/);
  assert.match(section, /from-craft/);
  assert.match(section, /from-honey/);
  assert.match(section, /from-nut-butter/);
  assert.match(section, /scroll-px-4 overscroll-x-contain/);
});
