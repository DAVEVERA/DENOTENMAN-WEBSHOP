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

test("uses only real parent relations and keeps localized route slugs", () => {
  const navigation = buildCategoryNavigation([
    source("noten", { slug: "nuts", name: "Nuts" }),
    source("notenmixen", { slug: "nut-mixes", name: "Nut mixes", parentId: "noten", sortOrder: 1 }),
    source("pinda-s", { slug: "peanuts", name: "Peanuts", parentId: "noten", sortOrder: 2 }),
  ]);

  assert.deepEqual(navigation.categories.map((category) => category.canonicalSlug), ["noten"]);
  assert.deepEqual(
    navigation.categories[0]?.children.map((category) => category.canonicalSlug),
    ["notenmixen", "pinda-s"]
  );
  assert.equal(categoryPath("en", navigation.categories[0]!.slug), "/en/category/nuts");
  assert.equal(
    categoryPath("en", navigation.categories[0]!.children[0]!.slug),
    "/en/category/nut-mixes"
  );
});

test("does not invent relationships for flat categories", () => {
  const navigation = buildCategoryNavigation([
    source("noten"),
    source("notenmixen", { sortOrder: 2 }),
    source("pinda-s", { sortOrder: 3 }),
  ]);

  assert.deepEqual(
    navigation.categories.map((category) => category.canonicalSlug),
    ["noten", "notenmixen", "pinda-s"]
  );
});

test("keeps a complete three-level Prisma hierarchy", () => {
  const navigation = buildCategoryNavigation([
    source("chocolade-zoet"),
    source("zoet", { parentId: "chocolade-zoet" }),
    source("gedroogd-fruit", { parentId: "zoet" }),
  ]);

  assert.equal(
    navigation.categories[0]?.children[0]?.children[0]?.canonicalSlug,
    "gedroogd-fruit"
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
