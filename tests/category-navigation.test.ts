import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCategoryNavigation,
  type NavigationCategorySourceDto,
} from "../lib/categoryGroups";
import { category as categoryPath } from "../lib/routes";

function source(
  canonicalSlug: string,
  overrides: Partial<NavigationCategorySourceDto> = {}
): NavigationCategorySourceDto {
  return {
    id: canonicalSlug,
    canonicalSlug,
    slug: canonicalSlug,
    name: canonicalSlug,
    description: null,
    type: "STANDARD",
    parentId: null,
    sortOrder: 0,
    ...overrides,
  };
}

test("uses localized route slugs while grouping the flat legacy tree by canonical slug", () => {
  const navigation = buildCategoryNavigation([
    source("noten", { slug: "nuts", name: "Nuts" }),
    source("notenmixen", { slug: "nut-mixes", name: "Nut mixes", sortOrder: 1 }),
    source("pinda-s", { slug: "peanuts", name: "Peanuts", sortOrder: 2 }),
    source("pitten-zaden", { slug: "seeds-grains", name: "Seeds", sortOrder: 3 }),
  ]);

  assert.deepEqual(navigation.categories.map((category) => category.canonicalSlug), ["noten"]);
  assert.deepEqual(
    navigation.categories[0]?.children.map((category) => category.canonicalSlug),
    ["notenmixen", "pinda-s", "pitten-zaden"]
  );
  assert.equal(categoryPath("en", navigation.categories[0]!.slug), "/en/category/nuts");
  assert.equal(
    categoryPath("en", navigation.categories[0]!.children[0]!.slug),
    "/en/category/nut-mixes"
  );
});

test("real Prisma children take precedence over the legacy slug fallback", () => {
  const navigation = buildCategoryNavigation([
    source("noten"),
    source("amandelen", { parentId: "noten", sortOrder: 1 }),
    source("notenmixen", { sortOrder: 2 }),
    source("pinda-s", { sortOrder: 3 }),
  ]);

  const nuts = navigation.categories.find((category) => category.canonicalSlug === "noten");
  assert.deepEqual(nuts?.children.map((category) => category.canonicalSlug), ["amandelen"]);
  assert.equal(
    navigation.categories.some((category) => category.canonicalSlug === "notenmixen"),
    true
  );
});

test("keeps the promotional root separate from standard category dropdowns", () => {
  const navigation = buildCategoryNavigation([
    source("noten"),
    source("acties", { name: "Kiloknallers", type: "PROMOTIONAL", sortOrder: 1 }),
  ]);

  assert.equal(navigation.promotional?.name, "Kiloknallers");
  assert.equal(
    navigation.categories.some((category) => category.type === "PROMOTIONAL"),
    false
  );
});

test("produces locale-correct category routes for nl, en and fr", () => {
  const routes = [
    categoryPath("nl", "noten"),
    categoryPath("en", "nuts"),
    categoryPath("fr", "noix"),
  ];

  assert.deepEqual(routes, [
    "/nl/categorie/noten",
    "/en/category/nuts",
    "/fr/categorie/noix",
  ]);
});
