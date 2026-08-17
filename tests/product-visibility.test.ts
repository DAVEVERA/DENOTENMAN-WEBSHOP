import assert from "node:assert/strict";
import test from "node:test";
import {
  productVisibilityInputSchema,
  productRevalidationPaths,
} from "../lib/product-visibility";

test("product visibility accepts only an explicit status and current version", () => {
  const version = "2026-08-17T12:00:00.000Z";

  assert.equal(
    productVisibilityInputSchema.safeParse({ isActive: true, version }).success,
    true
  );
  assert.equal(
    productVisibilityInputSchema.safeParse({ isActive: false, version }).success,
    true
  );
  assert.equal(productVisibilityInputSchema.safeParse({ isActive: true }).success, false);
  assert.equal(
    productVisibilityInputSchema.safeParse({ isActive: true, version, sku: "ignored" }).success,
    false
  );
});

test("product visibility invalidates admin, storefront, detail, category, and sitemap paths", () => {
  const paths = productRevalidationPaths({
    productId: "product-1",
    translations: [
      { locale: "nl", slug: "amandelen" },
      { locale: "en", slug: "almonds" },
    ],
    categoryTranslations: [{ locale: "nl", slug: "noten" }],
  });

  assert.deepEqual(
    paths.sort(),
    [
      "/admin",
      "/admin/producten",
      "/admin/producten/product-1",
      "/en",
      "/en/category",
      "/en/products/almonds",
      "/fr",
      "/fr/categorie",
      "/nl",
      "/nl/categorie",
      "/nl/categorie/noten",
      "/nl/producten/amandelen",
      "/sitemap.xml",
    ].sort()
  );
});
