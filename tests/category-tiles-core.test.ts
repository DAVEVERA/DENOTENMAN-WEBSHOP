import assert from "node:assert/strict";
import test from "node:test";

import { categorySubmenu, driedFruitSubcategories, searchSubmenuItems } from "../lib/category-submenu";
import { buildCategoryTiles, type TileProduct } from "../lib/category-tiles-core";
import type { NavigationCategoryDto } from "../lib/categoryGroups";

const node = (id: string, canonicalSlug: string, children: NavigationCategoryDto[] = []): NavigationCategoryDto => ({
  id,
  canonicalSlug,
  slug: canonicalSlug,
  name: canonicalSlug,
  description: null,
  type: "STANDARD",
  parentId: null,
  children,
});

const navigation = [
  node("n", "noten", [node("n1", "amandelen"), node("n2", "walnoten"), node("n3", "paranoten")]),
  node("g", "gedroogd-fruit"),
  node("h", "honing-natuurvoeding", [node("hh", "honing"), node("np", "notenpasta-s")]),
];

test("the submenu is the child categories, or the header's filter list when there are none", () => {
  assert.deepEqual(categorySubmenu(navigation, "noten", "nl").items.map((item) => item.key), ["amandelen", "walnoten", "paranoten"]);
  assert.equal(categorySubmenu(navigation, "gedroogd-fruit", "nl").items.length, driedFruitSubcategories.length);
  assert.equal(categorySubmenu(navigation, "honing", "en").items.length, 6);
  assert.equal(categorySubmenu(navigation, "notenpasta-s", "fr").items.length, 6);
  assert.equal(categorySubmenu(navigation, "bestaat-niet", "nl").root, undefined);
});

test("the header and the page build their filter links from the same function", () => {
  const items = searchSubmenuItems({ slug: "gedroogd-fruit" }, driedFruitSubcategories, "nl");
  assert.equal(items[0].href, "/nl/categorie?f=gedroogd-fruit&q=dadels#product-search");
  assert.equal(items.at(-1)?.href, "/nl/categorie/gedroogd-fruit", "the 'all' entry links to the category itself");
  assert.deepEqual(categorySubmenu(navigation, "gedroogd-fruit", "nl").items.map((item) => item.href), items.map((item) => item.href));
});

const product = (id: string, categoryIds: string[], extra: Partial<TileProduct> = {}): TileProduct => ({
  id,
  names: [id],
  categoryIds,
  imageSrc: `/img/${id}.webp`,
  sold: 0,
  ...extra,
});

test("a child category takes its best seller's photo and is hidden when empty", () => {
  const tiles = buildCategoryTiles(
    categorySubmenu(navigation, "noten", "nl").items,
    [product("a1", ["n1"], { sold: 1 }), product("a2", ["n1"], { sold: 9 }), product("w1", ["n2"], { imageSrc: null })],
    (id) => [id],
  );
  assert.deepEqual(tiles.map((tile) => tile.key), ["amandelen", "walnoten"], "paranoten has no products and is not shown");
  assert.equal(tiles[0].imageSrc, "/img/a2.webp");
  assert.equal(tiles[1].imageSrc, null, "a category whose products have no photo keeps the placeholder");
});

test("a catalogue filter is always kept and takes the best matching product's photo", () => {
  const tiles = buildCategoryTiles(
    categorySubmenu(navigation, "gedroogd-fruit", "nl").items,
    [product("x", ["g"], { names: ["zoete dadels"], sold: 3 }), product("y", ["g"], { names: ["biologische dadels"], sold: 7 }), product("z", ["g"], { names: ["vijgen"] })],
    (id) => [id],
  );
  assert.equal(tiles.length, driedFruitSubcategories.length, "no entry of the menu is dropped");
  assert.equal(tiles.find((tile) => tile.key === "dates")?.imageSrc, "/img/y.webp");
  assert.equal(tiles.find((tile) => tile.key === "raisins")?.imageSrc, null);
  // An English page still finds a product that only has a Dutch name.
  const english = buildCategoryTiles(categorySubmenu(navigation, "gedroogd-fruit", "en").items, [product("d", ["g"], { names: ["zoete dadels"] })], (id) => [id]);
  assert.equal(english.find((tile) => tile.key === "dates")?.imageSrc, "/img/d.webp");
  assert.equal(tiles.find((tile) => tile.key === "all-fruit")?.productCount, 3);
});
