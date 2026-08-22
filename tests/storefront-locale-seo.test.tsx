import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildStorefrontMetadata,
  resolvePromotionalCategorySlug,
} from "../lib/storefront-seo";
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

  const indexable = buildStorefrontMetadata({
    title: "Our range | De Notenman",
    description: "Browse the range.",
    alternates,
  });
  const empty = buildStorefrontMetadata({
    title: "Articles | De Notenman",
    description: "Practical articles.",
    alternates,
    noIndex: true,
  });

  assert.equal(indexable.alternates?.canonical, "/en/category");
  assert.deepEqual(indexable.alternates?.languages, alternates.languages);
  assert.equal(indexable.robots, undefined);
  assert.deepEqual(empty.robots, { index: false, follow: true });
});

test("renders the English accessible hero heading and carousel controls", () => {
  assert.equal(en.hero.accessibleHeadline, "Nuts, honey and dried fruit from De Notenman");
  assert.equal(en.hero.carouselLabel, "Product carousel");
});

test("renders the French accessible hero heading and carousel controls", () => {
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
