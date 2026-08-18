import assert from "node:assert/strict";
import test from "node:test";
import {
  latestMeaningfulDate,
  localizedSitemapEntries,
} from "../lib/sitemap";

test("localized sitemap entries add x-default and product images without ignored hints", { concurrency: false }, () => {
  const updatedAt = new Date("2026-08-18T12:00:00.000Z");
  const entries = localizedSitemapEntries({
    baseUrl: "https://shop.example",
    byLocale: [
      {
        locale: "nl",
        entries: [{
          id: "product-1",
          slug: "amandelen",
          updatedAt,
          images: ["https://cdn.example/products/amandelen/front.webp"],
        }],
      },
      {
        locale: "en",
        entries: [{
          id: "product-1",
          slug: "almonds",
          updatedAt,
          images: ["https://cdn.example/products/amandelen/front.webp"],
        }],
      },
      { locale: "fr", entries: [] },
    ],
    pathFor: (locale, slug) => `/${locale}/products/${slug}`,
  });

  assert.deepEqual(entries[0], {
    url: "https://shop.example/nl/products/amandelen",
    lastModified: updatedAt,
    images: ["https://cdn.example/products/amandelen/front.webp"],
    alternates: {
      languages: {
        nl: "https://shop.example/nl/products/amandelen",
        en: "https://shop.example/en/products/almonds",
        "x-default": "https://shop.example/nl/products/amandelen",
      },
    },
  });
  assert.equal("changeFrequency" in entries[0], false);
  assert.equal("priority" in entries[0], false);
});

test("latestMeaningfulDate ignores missing values and returns the newest date", () => {
  assert.equal(
    latestMeaningfulDate([
      undefined,
      new Date("2026-08-17T10:00:00.000Z"),
      new Date("2026-08-18T10:00:00.000Z"),
    ])?.toISOString(),
    "2026-08-18T10:00:00.000Z"
  );
  assert.equal(latestMeaningfulDate([undefined, undefined]), undefined);
});
