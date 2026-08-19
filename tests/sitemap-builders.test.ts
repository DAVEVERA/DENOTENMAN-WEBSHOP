import assert from "node:assert/strict";
import test from "node:test";
import {
  latestMeaningfulDate,
  localizedSitemapEntries,
} from "../lib/sitemap";
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";

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

test("product image URLs keep generated sitemap XML valid", { concurrency: false }, () => {
  const entries = localizedSitemapEntries({
    baseUrl: "https://shop.example",
    byLocale: [
      {
        locale: "nl",
        entries: [{
          id: "product-1",
          slug: "chiazaad",
          updatedAt: new Date("2026-08-19T12:00:00.000Z"),
          images: [
            "https://storage.googleapis.com/notenbucket/Pitten & Zaden/Chiazaad/front.webp",
            "https://cdn.example/image.webp?width=800&format=webp",
            "geen-geldige-url",
          ],
        }],
      },
      { locale: "en", entries: [] },
      { locale: "fr", entries: [] },
    ],
    pathFor: (locale, slug) => `/${locale}/products/${slug}`,
  });

  assert.deepEqual(entries[0]?.images, [
    "https://storage.googleapis.com/notenbucket/Pitten%20%26%20Zaden/Chiazaad/front.webp",
    "https://cdn.example/image.webp?width=800&amp;format=webp",
  ]);

  const xml = resolveSitemap(entries);
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9A-Fa-f]+;)/);
  assert.match(xml, /Pitten%20%26%20Zaden/);
  assert.match(xml, /width=800&amp;format=webp/);
});
