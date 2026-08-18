import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { groupMainCategories } from "../lib/categoryGroups";
import { PromotionalCategoryLink } from "../components/layout/PromotionalCategoryLink";
import type { MainCategoryDto } from "../lib/queries";

const standard: MainCategoryDto = {
  id: "noten",
  slug: "noten",
  name: "Noten",
  description: null,
  type: "STANDARD",
};
const promotional: MainCategoryDto = {
  id: "promo",
  slug: "acties",
  name: "Kiloknallers",
  description: null,
  type: "PROMOTIONAL",
};

test("keeps a promotional category out of the standard category groups", () => {
  const result = groupMainCategories([standard, promotional]);

  assert.equal(result.promotional?.id, promotional.id);
  assert.equal(result.groups.some((group) => group.categories.some((item) => item.id === promotional.id)), false);
});

test("renders the active promo contract as a localized accessible yellow link", () => {
  const markup = renderToStaticMarkup(
    <PromotionalCategoryLink category={promotional} locale="nl" />
  );

  assert.match(markup, /href="\/nl\/categorie\/acties"/);
  assert.match(markup, />Kiloknallers</);
  assert.match(markup, /bg-accent/);
  assert.match(markup, /min-h-11/);
});
