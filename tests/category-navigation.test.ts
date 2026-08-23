import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCategoryNavigation,
  type NavigationCategorySourceDto,
} from "../lib/categoryGroups";
import { category as categoryPath } from "../lib/routes";
import {
  storefrontMenuParentSlug,
  storefrontMenuRootOrder,
} from "../lib/storefront-menu-taxonomy";

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

test("keeps dried fruit as an independent root", () => {
  const navigation = buildCategoryNavigation([
    source("gedroogd-fruit", { sortOrder: 1 }),
    source("chocolade-zoet", { sortOrder: 2 }),
    source("zoet", { parentId: "chocolade-zoet" }),
  ]);

  assert.deepEqual(
    navigation.categories.map((category) => category.canonicalSlug),
    ["gedroogd-fruit", "chocolade-zoet"]
  );
});

test("groups kernels and seeds below one clickable root and exposes every leaf", () => {
  const navigation = buildCategoryNavigation([
    source("chocolade-zoet", { sortOrder: 1 }),
    source("chocolade", { parentId: "chocolade-zoet", sortOrder: 1 }),
    source("chocolade-amandelen", { parentId: "chocolade", sortOrder: 1 }),
    source("chocolade-rotsjes", { parentId: "chocolade", sortOrder: 2 }),
    source("studenten-flikken", { parentId: "chocolade", sortOrder: 7 }),
    source("pitten-zaden", { sortOrder: 2 }),
    source("pitten", { parentId: "pitten-zaden", sortOrder: 1 }),
    source("pompoenpitten", { parentId: "pitten", sortOrder: 1 }),
    source("zonnebloempitten", { parentId: "pitten", sortOrder: 2 }),
    source("pijnboompitten", { parentId: "pitten", sortOrder: 3 }),
    source("zaden", { parentId: "pitten-zaden", sortOrder: 2 }),
    source("lijnzaad", { parentId: "zaden", sortOrder: 1 }),
    source("sesamzaad", { parentId: "zaden", sortOrder: 2 }),
    source("chiazaad", { parentId: "zaden", sortOrder: 3 }),
    source("hennepzaad", { parentId: "zaden", sortOrder: 4 }),
    source("maanzaad", { parentId: "zaden", sortOrder: 5 }),
    source("zadenmixen-granen", { parentId: "zaden", sortOrder: 6 }),
  ]);

  assert.deepEqual(
    navigation.categories.map((category) => category.canonicalSlug),
    ["chocolade-zoet", "pitten-zaden"]
  );
  assert.deepEqual(
    navigation.categories[0]?.children[0]?.children.map(
      (category) => category.canonicalSlug
    ),
    ["chocolade-amandelen", "chocolade-rotsjes", "studenten-flikken"]
  );
  assert.deepEqual(
    navigation.categories[1]?.children.map((category) => category.canonicalSlug),
    ["pitten", "zaden"]
  );
  assert.deepEqual(
    navigation.categories[1]?.children[0]?.children.map((category) => category.canonicalSlug),
    ["pompoenpitten", "zonnebloempitten", "pijnboompitten"]
  );
  assert.deepEqual(
    navigation.categories[1]?.children[1]?.children.map((category) => category.canonicalSlug),
    ["lijnzaad", "sesamzaad", "chiazaad", "hennepzaad", "maanzaad", "zadenmixen-granen"]
  );
});

test("locks the storefront root order and requested parent relations", () => {
  assert.deepEqual(storefrontMenuRootOrder, [
    "noten",
    "gedroogd-fruit",
    "chocolade-zoet",
    "muesli-granen",
    "pitten-zaden",
    "snacks-zoutjes",
    "bakproducten",
    "honing-natuurvoeding",
  ]);
  assert.deepEqual(storefrontMenuParentSlug, {
    "gedroogd-fruit": null,
    "pitten-zaden": null,
    pitten: "pitten-zaden",
    zaden: "pitten-zaden",
  });
});

test("keeps the promotional root separate from standard category dropdowns", () => {
  const navigation = buildCategoryNavigation([
    source("noten"),
    source("acties", { name: "Acties", type: "PROMOTIONAL", sortOrder: 1 }),
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
