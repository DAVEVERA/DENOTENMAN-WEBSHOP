import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { NavigationCategoryDto } from "../lib/categoryGroups";
import { MegaMenu, nextTopLevelIndex } from "../components/layout/MegaMenu";
import * as megaMenuModule from "../components/layout/MegaMenu";
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
    category("gedroogd-fruit"),
    category("pitten-zaden", [
      category("pitten", [category("pompoenpitten")]),
      category("zaden", [category("lijnzaad")]),
    ]),
  ];

  assert.equal(resolveCategoryPath(tree, ["gedroogd-fruit"])?.name, "gedroogd-fruit");
  assert.equal(
    resolveCategoryPath(tree, ["pitten-zaden", "zaden", "lijnzaad"])?.name,
    "lijnzaad"
  );
  assert.equal(resolveCategoryPath(tree, ["pitten-zaden", "noten"]), null);
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

test("menu category navigation uses a native anchor so localized rewrites resolve on the server", () => {
  const module = megaMenuModule as unknown as {
    NativeCategoryLink?: (props: {
      href: string;
      children: React.ReactNode;
    }) => { type: unknown; props: { href?: string } };
  };

  assert.equal(typeof module.NativeCategoryLink, "function");
  if (!module.NativeCategoryLink) return;

  const element = module.NativeCategoryLink({
    href: "/nl/categorie/studenten-flikken",
    children: "Studenten Flikken",
  });

  assert.equal(element.type, "a");
  assert.equal(element.props.href, "/nl/categorie/studenten-flikken");
});

test("mobile branch label navigates while a separate control opens its children", () => {
  const module = mobileNavModule as unknown as {
    MobileCategoryRow?: (props: {
      category: NavigationCategoryDto;
      locale: "nl";
      submenuLabel: string;
      subcategoryLabel: string;
      subcategoriesLabel: string;
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
      subcategoryLabel="{count} subcategorie"
      subcategoriesLabel="{count} subcategorieën"
      onFollow={() => undefined}
      onOpen={() => undefined}
    />
  );

  assert.match(markup, /<a[^>]+href="\/nl\/categorie\/chocolade"/);
  assert.match(markup, /<button[^>]+aria-label="Open submenu voor chocolade"/);
  assert.match(markup, />1 subcategorie</);
  assert.match(markup, /min-h-12/);
  assert.match(markup, /min-w-12/);
});

test("mobile menu provides drilldown, back, overview and 44px touch targets", () => {
  const source = readFileSync("components/layout/MobileNav.tsx", "utf8");
  const dialogClasses = [...source.matchAll(/role="dialog"[\s\S]*?className="([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.match(source, /setLevel\(\[\.\.\.categoryIds, category\.id\]\)/);
  assert.match(source, /categoryIds\.slice\(0, -1\)/);
  assert.match(source, /dictionary\.nav\.viewAllCategory/);
  assert.match(source, /dictionary\.nav\.chooseSubcategory/);
  assert.match(source, /dictionary\.nav\.subcategoriesCount/);
  assert.match(source, /previousPathnameRef/);
  assert.match(source, /levelHeadingRef\.current\?\.focus\(\)/);
  assert.match(source, /min-h-11/);
  assert.match(source, /min-h-12/);
  assert.match(source, /touch-manipulation/);
  assert.match(source, /<NativeCategoryLink\s+href=\{categoryPath\(locale, activeCategory\.slug\)\}/);
  assert.match(source, /createPortal\(/);
  assert.equal(source.match(/,\s*document\.body\s*\)/g)?.length, 2);
  assert.equal(dialogClasses.length, 2);
  assert.ok(dialogClasses.every((className) => className.split(" ").includes("z-10")));
});

test("header exposes every standard root returned by the navigation query", () => {
  const source = readFileSync("components/layout/Header.tsx", "utf8");

  assert.match(source, /const categories = navigation\.categories;/);
  assert.doesNotMatch(source, /hiddenNavCategorySlugs/);
});

test("header switches mobile and desktop navigation at one coherent breakpoint", () => {
  const headerSource = readFileSync("components/layout/Header.tsx", "utf8");
  const mobileSource = readFileSync("components/layout/MobileNav.tsx", "utf8");

  assert.match(headerSource, /border-b-2 border-contrast bg-surface xl:block/);
  assert.match(mobileSource, /grid w-full grid-cols-4[^"]*xl:hidden/);
});

test("mobile search dialog traps keyboard focus inside its own panel", () => {
  const source = readFileSync("components/layout/MobileNav.tsx", "utf8");

  assert.match(source, /const searchPanelRef = useRef<HTMLElement>\(null\)/);
  assert.match(source, /searchOpen\s*\? searchPanelRef\.current/);
  assert.match(source, /input:not\(\[disabled\]\)/);
  assert.match(source, /textarea:not\(\[disabled\]\), summary/);
  assert.match(source, /element\.getClientRects\(\)\.length > 0/);
  assert.match(source, /element\.closest\("details:not\(\[open\]\)"\)/);
  assert.match(source, /ref=\{searchPanelRef\}\s+role="dialog"/);
});
