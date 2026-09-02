import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the homepage renders three content-aware hero slides without navigation controls", async () => {
  const [
    component,
    categories,
    homepage,
    nlDictionary,
    enDictionary,
    frDictionary,
    ...assets
  ] = await Promise.all([
    readFile("components/home/HomeHero.tsx", "utf8"),
    readFile("components/home/HomeCategoryEntrances.tsx", "utf8"),
    readFile("app/[locale]/page.tsx", "utf8"),
    readFile("dictionaries/nl.json", "utf8"),
    readFile("dictionaries/en.json", "utf8"),
    readFile("dictionaries/fr.json", "utf8"),
    stat("public/hero/hero-nuts-desktop.webp"),
    stat("public/hero/hero-nuts-mobile.webp"),
    stat("public/hero/hero-honey-desktop.webp"),
    stat("public/hero/hero-honey-mobile.webp"),
    stat("public/hero/hero-nutbutter-desktop.webp"),
    stat("public/hero/hero-nutbutter-mobile.webp"),
    stat("public/home/notenpasta-story-desktop.webp"),
    stat("public/home/notenpasta-story-mobile.webp"),
    stat("public/home/de-notenman-marktbak.webp"),
  ]);

  assert.equal((component.match(/<h1\b/g) ?? []).length, 1);
  assert.match(component, /"use client"/);
  assert.match(component, /aria-roledescription="carousel"/);
  assert.match(component, /<picture\b/);
  assert.match(component, /media="\(min-width: 1024px\)"/);
  assert.match(component, /object-contain/);
  assert.match(component, /fetchPriority=\{index === 0 \? "high" : "auto"\}/);
  assert.match(component, /bg-white\/\[0\.84\]/);
  assert.match(component, /bg-gradient-to-b/);
  assert.match(component, /onTouchStart|onTouchEnd|onKeyDown/);
  assert.match(component, /ArrowLeft|ArrowRight/);
  assert.match(component, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(component, /setTimeout|clearTimeout/);
  assert.match(component, /motion-reduce:transition-none/);
  assert.match(component, /lg:max-w-\[24rem\]/);
  assert.doesNotMatch(component, /<button|ChevronLeft|ChevronRight|aria-current/);

  assert.match(categories, /-mt-\[5\.25rem\]/);
  assert.match(categories, /grid-cols-2/);
  assert.match(categories, /sm:grid-cols-3/);
  assert.match(categories, /lg:grid-cols-6/);
  assert.doesNotMatch(categories, /snap-x|overflow-x-auto/);
  assert.doesNotMatch(categories, /border-t-2 border-t-contrast/);
  assert.match(categories, /sizes="\(max-width: 639px\) 45vw/);
  assert.match(categories, /alt=""/);
  assert.doesNotMatch(categories, /padStart|String\(index \+ 1\)/);

  assert.match(homepage, /const heroSlides = dictionary\.home\.hero\.slides\.map/);
  assert.match(homepage, /carouselLabel=\{dictionary\.home\.hero\.carouselLabel\}/);
  assert.match(homepage, /slides=\{heroSlides\}/);
  assert.match(homepage, /findNavigationCategory/);
  assert.match(homepage, /"notenpasta-s"/);
  assert.match(homepage, /<HomeCategoryEntrances/);
  assert.match(homepage, /<USPBar dictionary=\{dictionary\} shipping=\{shippingUsp\}/);
  assert.match(homepage, /<HomeNutButterStory/);
  // Notenpasta's now sits one level up, swapped with the honey section.
  const storyIndex = homepage.indexOf("<HomeCraftStory");
  const nutsIndex = homepage.indexOf("products={homeProducts.nuts}");
  const nutButterStoryIndex = homepage.indexOf("<HomeNutButterStory");
  const nutButterProductsIndex = homepage.indexOf("products={homeProducts.nutButters}");
  const honeyStoryIndex = homepage.indexOf("<HomeHoneyStory");
  const honeyIndex = homepage.indexOf("products={homeProducts.honey}");
  assert.ok(storyIndex < nutsIndex);
  assert.ok(nutsIndex < nutButterStoryIndex);
  assert.ok(nutButterStoryIndex < nutButterProductsIndex);
  assert.ok(nutButterProductsIndex < honeyStoryIndex);
  assert.ok(honeyStoryIndex < honeyIndex);
  assert.equal((homepage.match(/<HomeFeaturedProducts/g) ?? []).length, 3);
  assert.match(homepage, /imageSrc="\/home\/de-notenman-marktbak\.webp"/);
  assert.match(homepage, /dictionary\.home\.honeyStory/);
  assert.doesNotMatch(homepage, /previousLabel|nextLabel/);
  assert.doesNotMatch(homepage, /<NewsletterSignup/);

  for (const dictionarySource of [nlDictionary, enDictionary, frDictionary]) {
    const dictionary = JSON.parse(dictionarySource);
    assert.equal(dictionary.home.hero.slides.length, 3);
    assert.deepEqual(
      dictionary.home.hero.slides.map((slide: { category: string }) => slide.category),
      ["noten", "honing", "notenpasta-s"],
    );
    assert.ok(dictionary.home.hero.slides.every((slide: { cta: string }) => slide.cta));
  }

  for (const asset of assets) {
    assert.ok(asset.size < 500_000);
  }
});

test("the panorama runtime, public route and iframe integration are removed", async () => {
  const [homepage, config] = await Promise.all([
    readFile("app/[locale]/page.tsx", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);

  await assert.rejects(access("public/lepelpanorama"));
  await assert.rejects(access("components/home/LepelPanoramaHero.tsx"));
  await assert.rejects(access("components/home/LepelPanoramaHero.module.css"));
  assert.doesNotMatch(homepage, /LepelPanorama|lepelpanorama|<iframe/);
  assert.doesNotMatch(config, /lepelpanorama|X-Robots-Tag/);
});
