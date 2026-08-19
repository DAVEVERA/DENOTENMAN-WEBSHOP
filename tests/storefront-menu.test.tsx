import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { NavigationCategoryDto } from "../lib/categoryGroups";
import { MegaMenu, nextTopLevelIndex } from "../components/layout/MegaMenu";
import { resolveCategoryPath } from "../components/layout/MobileNav";
import * as mobileNavModule from "../components/layout/MobileNav";

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

test("desktop branch label navigates to its category beside a separate disclosure button", () => {
  const root = category("noten", [category("amandelen")]);
  const markup = renderToStaticMarkup(
    <MegaMenu
      categories={[root]}
      locale="nl"
      labels={{
        submenu: "Open submenu voor {category}",
        viewAll: "Bekijk alle {category}",
      }}
    />
  );

  assert.match(markup, /<a[^>]+href="\/nl\/categorie\/noten"[^>]*>noten<\/a>/);
  assert.match(markup, /<button[^>]+aria-label="Open submenu voor noten"/);
});

test("mobile branch label navigates while a separate control opens its children", () => {
  const module = mobileNavModule as unknown as {
    MobileCategoryRow?: (props: {
      category: NavigationCategoryDto;
      locale: "nl";
      submenuLabel: string;
      emphasized?: boolean;
      onFollow: () => void;
      onOpen: () => void;
    }) => React.ReactNode;
  };

  assert.equal(typeof module.MobileCategoryRow, "function");
  if (!module.MobileCategoryRow) return;

  const markup = renderToStaticMarkup(
    <module.MobileCategoryRow
      category={category("chocolade", [category("chocolade-amandelen")])}
      locale="nl"
      submenuLabel="Open submenu voor {category}"
      onFollow={() => undefined}
      onOpen={() => undefined}
    />
  );

  assert.match(markup, /<a[^>]+href="\/nl\/categorie\/chocolade"/);
  assert.match(markup, /<button[^>]+aria-label="Open submenu voor chocolade"/);
  assert.match(markup, /min-h-12/);
  assert.match(markup, /min-w-12/);
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
  assert.match(source, /<Link\s+href=\{categoryPath\(locale, activeCategory\.slug\)\}/);
});

test("header exposes every standard root returned by the navigation query", () => {
  const source = readFileSync("components/layout/Header.tsx", "utf8");

  assert.match(source, /const categories = navigation\.categories;/);
  assert.doesNotMatch(source, /hiddenNavCategorySlugs/);
});
