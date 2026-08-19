import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { VideoHero } from "../components/layout/VideoHero";
import {
  buildStorefrontMetadata,
  resolvePromotionalCategorySlug,
} from "../lib/storefront-seo";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

const imageConfig = {
  ...imageConfigDefault,
  qualities: [70, 75],
  remotePatterns: [{ protocol: "https" as const, hostname: "storage.googleapis.com" }],
};

function renderHero(locale: "en" | "fr", dictionary: typeof en | typeof fr) {
  return renderToStaticMarkup(
    <ImageConfigContext.Provider value={imageConfig}>
      <VideoHero locale={locale} dictionary={dictionary} />
    </ImageConfigContext.Provider>,
  );
}

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

test("renders English hero copy with English product links", () => {
  const markup = renderHero("en", en);

  assert.match(markup, /Delicious freshly roasted nuts &amp; dried fruit!/);
  assert.match(markup, /href="\/en\/products\/shelled-and-roasted-pistachios"/);
  assert.match(markup, /href="\/en\/products\/salted-cashew-nuts"/);
  assert.doesNotMatch(markup, /\/en\/products\/pistaches-gepeld-gebrand/);
});

test("renders French hero copy with current French product links", () => {
  const markup = renderHero("fr", fr);

  assert.match(markup, /Délicieuses noix fraîchement torréfiées/);
  assert.match(markup, /href="\/fr\/produits\/pistaches-decortiquees-et-grillees"/);
  assert.match(markup, /href="\/fr\/produits\/noix-de-cajou-salees"/);
  assert.doesNotMatch(markup, /\/fr\/produits\/cashewnoten-gezouten/);
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
