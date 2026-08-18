import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NavigationCategoryDto } from "../lib/categoryGroups";
import { nextTopLevelIndex } from "../components/layout/MegaMenu";
import { resolveCategoryPath } from "../components/layout/MobileNav";

function category(
  id: string,
  children: NavigationCategoryDto[] = []
): NavigationCategoryDto {
  return {
    id,
    canonicalSlug: id,
    slug: id,
    name: id,
    description: null,
    type: "STANDARD",
    parentId: null,
    children,
  };
}

test("desktop category keyboard navigation wraps and supports Home and End", () => {
  assert.equal(nextTopLevelIndex(4, 0, "ArrowLeft"), 3);
  assert.equal(nextTopLevelIndex(4, 3, "ArrowRight"), 0);
  assert.equal(nextTopLevelIndex(4, 2, "Home"), 0);
  assert.equal(nextTopLevelIndex(4, 1, "End"), 3);
});

test("mobile drilldown resolves categories at arbitrary tree depth", () => {
  const tree = [
    category("chocolade-zoet", [
      category("zoet", [category("gedroogd-fruit", [category("dadels")])]),
    ]),
  ];

  assert.equal(resolveCategoryPath(tree, ["chocolade-zoet"])?.name, "chocolade-zoet");
  assert.equal(
    resolveCategoryPath(tree, ["chocolade-zoet", "zoet", "gedroogd-fruit"])?.name,
    "gedroogd-fruit"
  );
  assert.equal(resolveCategoryPath(tree, ["chocolade-zoet", "noten"]), null);
});

test("desktop menu uses disclosure buttons only for branches and direct links for leaves", () => {
  const source = readFileSync("components/layout/MegaMenu.tsx", "utf8");

  assert.match(source, /hasChildren \? \(/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /hidden=\{!expanded\}/);
  assert.doesNotMatch(source, /aria-haspopup=/);
  assert.match(source, /event\.key !== "Home"/);
  assert.match(source, /event\.key !== "End"/);
  assert.match(source, /DescendantLinks/);
});

test("mobile menu provides drilldown, back, overview and 44px touch targets", () => {
  const source = readFileSync("components/layout/MobileNav.tsx", "utf8");

  assert.match(source, /setLevel\(\[\.\.\.categoryIds, category\.id\]\)/);
  assert.match(source, /categoryIds\.slice\(0, -1\)/);
  assert.match(source, /dictionary\.nav\.viewAllCategory/);
  assert.match(source, /previousPathnameRef/);
  assert.match(source, /levelHeadingRef\.current\?\.focus\(\)/);
  assert.match(source, /min-h-11/);
  assert.match(source, /min-h-12/);
  assert.match(source, /touch-manipulation/);
  assert.match(source, /<a\s+href=\{categoryPath\(locale, activeCategory\.slug\)\}/);
});

test("header exposes every standard root returned by the navigation query", () => {
  const source = readFileSync("components/layout/Header.tsx", "utf8");

  assert.match(source, /const categories = navigation\.categories;/);
  assert.doesNotMatch(source, /hiddenNavCategorySlugs/);
});
