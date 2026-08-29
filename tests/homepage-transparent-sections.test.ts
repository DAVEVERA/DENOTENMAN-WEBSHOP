import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homepage = readFileSync("app/[locale]/page.tsx", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const headerStyles = readFileSync(
  "components/layout/CompactHeader.module.css",
  "utf8",
);

const sectionSources = [
  "components/home/HomeHero.tsx",
  "components/home/HomeCategoryEntrances.tsx",
  "components/ui/USPBar.tsx",
  "components/home/HomeCraftStory.tsx",
  "components/home/HomeFeaturedProducts.tsx",
  "components/home/HomeHoneyStory.tsx",
  "components/home/HomeNutButterStory.tsx",
  "components/home/HomeServiceProof.tsx",
  "components/home/HomeAssortmentCta.tsx",
  "components/home/NewsletterSignup.tsx",
].map((path) => ({ path, source: readFileSync(path, "utf8") }));

test("the landing page has one canvas token and transparent content-section roots", () => {
  assert.match(globals, /--color-home-canvas: #F6F3EE;/);
  assert.match(homepage, /<SiteShell\s+className="bg-home-canvas"/);
  assert.doesNotMatch(homepage, /tone="from-/);

  for (const { path, source } of sectionSources) {
    assert.match(source, /data-home-section=/, `${path} needs a section marker`);
    assert.match(source, /bg-transparent/, `${path} needs a transparent root`);
  }
});

test("necessary image fades follow the landing canvas instead of fixed cream bands", () => {
  const hero = readFileSync("components/home/HomeHero.tsx", "utf8");
  const craft = readFileSync("components/home/HomeCraftStory.tsx", "utf8");
  const honey = readFileSync("components/home/HomeHoneyStory.tsx", "utf8");
  const nutButter = readFileSync(
    "components/home/HomeNutButterStory.tsx",
    "utf8",
  );

  assert.match(hero, /via-home-canvas\/70 to-home-canvas/);
  assert.match(craft, /to-home-canvas/);
  assert.match(honey, /from-home-canvas via-home-canvas\/90 to-transparent/);
  assert.match(nutButter, /from-home-canvas to-transparent/);

  for (const source of [hero, craft, honey, nutButter]) {
    assert.doesNotMatch(
      source,
      /#f3eee5_0%|#f4efe6_0%|#efe8dc_0%|#faf8f4_0%/,
    );
  }
});

test("foreground surfaces keep explicit colours and the compact navbar keeps its current token", () => {
  const categories = readFileSync(
    "components/home/HomeCategoryEntrances.tsx",
    "utf8",
  );
  const hero = readFileSync("components/home/HomeHero.tsx", "utf8");
  const craft = readFileSync("components/home/HomeCraftStory.tsx", "utf8");
  const service = readFileSync("components/home/HomeServiceProof.tsx", "utf8");
  const assortment = readFileSync(
    "components/home/HomeAssortmentCta.tsx",
    "utf8",
  );
  const newsletter = readFileSync(
    "components/home/NewsletterSignup.tsx",
    "utf8",
  );
  const card = readFileSync("components/ui/Card.tsx", "utf8");

  assert.match(categories, /bg-white\/\[0\.97\]/);
  assert.match(hero, /bg-white\/\[0\.84\]/);
  assert.match(craft, /bg-\[#eadbaf\]/);
  assert.match(craft, /bg-accent/);
  assert.match(service, /bg-\[#f6f3ee\]\/75/);
  assert.match(assortment, /bg-\[#121212\]/);
  assert.match(newsletter, /bg-\[#121212\]/);
  assert.match(card, /bg-surface/);

  assert.match(
    headerStyles,
    /background: color-mix\(in oklab, var\(--color-background\) 88%, transparent\);/,
  );
  assert.doesNotMatch(headerStyles, /home-canvas/);
});
