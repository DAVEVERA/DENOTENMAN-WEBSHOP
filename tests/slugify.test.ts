import assert from "node:assert/strict";
import test from "node:test";
import { resolveFrenchCategorySlug } from "../lib/french-category-redirects";
import { legacySlugify, planFrenchProductSlugs } from "../lib/french-slug-plan";
import { slugify } from "../lib/slugify";

test("slugify behoudt Franse letters via accentveilige transliteratie", () => {
  assert.equal(slugify("Cacahuètes grillées non salées"), "cacahuetes-grillees-non-salees");
  assert.equal(slugify("Mélanges de noix"), "melanges-de-noix");
  assert.equal(slugify("Étudiants policiers blancs"), "etudiants-policiers-blancs");
});

test("beschadigde Franse categorie-slugs worden pas runtime naar hun doel opgelost", () => {
  assert.equal(resolveFrenchCategorySlug("cacahu-tes"), "cacahuetes");
  assert.equal(resolveFrenchCategorySlug("m-langes-de-noix"), "melanges-de-noix");
  assert.equal(resolveFrenchCategorySlug("muesli-c-r-ales"), "muesli-cereales");
  assert.equal(
    resolveFrenchCategorySlug("produits-de-p-tisserie"),
    "produits-de-patisserie"
  );
  assert.equal(resolveFrenchCategorySlug("noix"), undefined);
});

test("de migratie verandert alleen aantoonbaar door de oude generator gemaakte slugs", () => {
  assert.equal(legacySlugify("Crème mélangée"), "cr-me-m-lang-e");
  assert.deepEqual(
    planFrenchProductSlugs([
      { productId: "legacy", name: "Crème mélangée", slug: "cr-me-m-lang-e" },
      { productId: "editorial", name: "Crème spéciale", slug: "selection-du-chef" },
    ]).map(({ productId, nextSlug }) => ({ productId, nextSlug })),
    [{ productId: "legacy", nextSlug: "creme-melangee" }]
  );
});

test("dubbele Franse productnamen krijgen stabiele unieke slugs", () => {
  assert.deepEqual(
    planFrenchProductSlugs([
      { productId: "b", name: "Pâte d'amande", slug: "p-te-d-amande-1" },
      { productId: "a", name: "Pâte d'amande", slug: "p-te-d-amande" },
      { productId: "c", name: "Déjà correct", slug: "deja-correct" },
    ]).map(({ productId, slug, nextSlug }) => ({ productId, slug, nextSlug })),
    [
      {
        productId: "a",
        slug: "p-te-d-amande",
        nextSlug: "pate-d-amande",
      },
      {
        productId: "b",
        slug: "p-te-d-amande-1",
        nextSlug: "pate-d-amande-1",
      },
    ]
  );
});
