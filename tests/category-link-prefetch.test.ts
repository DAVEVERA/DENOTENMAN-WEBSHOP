import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const categoryLinkSources = [
  "components/home/HomeHero.tsx",
  "components/home/HomeCategoryEntrances.tsx",
  "components/home/HomeFeaturedProducts.tsx",
  "components/home/HomeHoneyStory.tsx",
  "components/home/HomeNutButterStory.tsx",
  "components/layout/Footer.tsx",
];

test("localized category links disable speculative segment prefetch", async () => {
  for (const path of categoryLinkSources) {
    const source = await readFile(path, "utf8");

    assert.match(
      source,
      /prefetch=\{false\}/,
      `${path} must avoid rewritten category segment prefetches`,
    );
  }
});
