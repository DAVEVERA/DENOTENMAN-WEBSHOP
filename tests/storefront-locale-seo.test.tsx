import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolvePromotionalCategorySlug } from "../lib/storefront-seo";
import { buildMetadata } from "../lib/seo/metadata";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

test("builds self-canonical localized metadata and only noindexes an empty collection", () => {
  const alternates = {
    canonical: "/en/category",
    languages: {
      nl: "/nl/categorie",
      en: "/en/category",
      fr: "/fr/categorie",
    },
  } as const;

  const indexable = buildMetadata({
    title: "Our range | De Notenman",
    description: "Browse the range.",
    locale: "en",
    alternates,
  });
  const empty = buildMetadata({
    title: "Articles | De Notenman",
    description: "Practical articles.",
    locale: "en",
    alternates,
    noIndex: true,
  });

  assert.equal(indexable.alternates?.canonical, "/en/category");
  assert.deepEqual(indexable.alternates?.languages, alternates.languages);
  assert.equal(indexable.robots, undefined);
  assert.deepEqual(empty.robots, { index: false, follow: true });
});

test("renders the English accessible hero heading and carousel label", () => {
  assert.equal(en.hero.accessibleHeadline, "Nuts, honey and dried fruit from De Notenman");
  assert.equal(en.hero.carouselLabel, "Product carousel");
});

test("renders the French accessible hero heading and carousel label", () => {
  assert.equal(fr.hero.accessibleHeadline, "Noix, miel et fruits secs de De Notenman");
  assert.equal(fr.hero.carouselLabel, "Carrousel de produits");
});

test("resolves the localized promotional slug instead of assuming the Dutch slug", () => {
  assert.equal(
    resolvePromotionalCategorySlug([
      { slug: "nuts", type: "STANDARD" },
      { slug: "deals", type: "PROMOTIONAL" },
    ]),
    "deals"
  );
  assert.equal(
    resolvePromotionalCategorySlug([
      { slug: "noix", type: "STANDARD" },
      { slug: "promotions", type: "PROMOTIONAL" },
    ]),
    "promotions"
  );
});

test("locale layout does not leak homepage alternates into descendant routes", () => {
  const source = readFileSync("app/[locale]/layout.tsx", "utf8");

  assert.doesNotMatch(source, /getAlternates/);
  assert.doesNotMatch(source, /type:\s*["']home["']/);
  assert.match(source, /metadataBase:\s*new URL\(BASE_URL\)/);
  assert.match(source, /\bicons,?/);
});

test("every page gets a shareable card: og:locale, absolute url, large twitter card", () => {
  const metadata = buildMetadata({
    title: "Our range | De Notenman",
    description: "Browse the range.",
    locale: "en",
    alternates: {
      canonical: "/en/category",
      languages: { en: "/en/category" },
    },
  });

  assert.equal(metadata.openGraph?.locale, "en_GB");
  assert.equal(metadata.openGraph?.siteName, "De Notenman");
  const twitter = metadata.twitter;
  assert.equal(
    twitter && "card" in twitter ? twitter.card : undefined,
    "summary_large_image"
  );

  // Relative og:url is dropped by most scrapers, so it must be absolute.
  const url = metadata.openGraph && "url" in metadata.openGraph ? metadata.openGraph.url : undefined;
  assert.match(String(url), /^https?:\/\/[^/]+\/en\/category$/);
});

test("a page-specific photo is emitted absolute, sized and with alt text", () => {
  const metadata = buildMetadata({
    title: "Cashews | De Notenman",
    description: "Freshly roasted cashews.",
    locale: "nl",
    image: { url: "/brand/logo-wordmark-email.png", alt: "Cashews" },
  });

  const images = metadata.openGraph && "images" in metadata.openGraph
    ? metadata.openGraph.images
    : undefined;
  const [image] = Array.isArray(images) ? images : [];

  assert.ok(image && typeof image === "object" && "url" in image);
  assert.match(String((image as { url: unknown }).url), /^https?:\/\//);
  assert.deepEqual(
    { width: (image as { width: unknown }).width, height: (image as { height: unknown }).height },
    { width: 1200, height: 630 }
  );
  assert.equal((image as { alt: unknown }).alt, "Cashews");
});

test("og:locale covers every supported locale", () => {
  assert.equal(buildMetadata({ title: "t", locale: "nl" }).openGraph?.locale, "nl_NL");
  assert.equal(buildMetadata({ title: "t", locale: "en" }).openGraph?.locale, "en_GB");
  assert.equal(buildMetadata({ title: "t", locale: "fr" }).openGraph?.locale, "fr_FR");
});

test("pages without a photo leave og:image to the segment's card route", () => {
  const metadata = buildMetadata({ title: "t", locale: "nl" });

  assert.ok(metadata.openGraph);
  assert.equal("images" in metadata.openGraph!, false);
});
