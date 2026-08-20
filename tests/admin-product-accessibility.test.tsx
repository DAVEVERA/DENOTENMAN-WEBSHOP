import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoutButton } from "../components/admin-panel/LogoutButton";
import { NutritionEditor, emptyNutritionValues } from "../components/admin-panel/NutritionEditor";
import { RichTextEditor } from "../components/admin-panel/RichTextEditor";
import * as translationsModule from "../components/admin-panel/ProductTranslationsEditor";

test("mobile admin controls expose at least 44px target classes", () => {
  const toolbar = renderToStaticMarkup(
    <RichTextEditor id="description" value="" onChange={() => undefined} ariaLabel="Omschrijving" />
  );
  const nutrition = renderToStaticMarkup(
    <NutritionEditor values={emptyNutritionValues()} onChange={() => undefined} unit="WEIGHT" />
  );
  const logout = renderToStaticMarkup(<LogoutButton />);
  const navigationSource = readFileSync("components/admin-panel/AdminNav.tsx", "utf8");
  const productPageSource = readFileSync("app/admin/(dashboard)/producten/[id]/page.tsx", "utf8");
  const loginSource = readFileSync("app/admin/login/page.tsx", "utf8");

  assert.doesNotMatch(toolbar, /min-h-10|min-w-10/);
  assert.match(toolbar, /min-h-11 min-w-11/);
  assert.doesNotMatch(nutrition, /min-h-10/);
  assert.match(logout, /min-h-11/);
  assert.match(navigationSource, /min-h-11/);
  assert.match(productPageSource, /min-h-11/);
  assert.match(loginSource, /role="alert"/);
  assert.match(loginSource, /min-h-11/);
});

test("product rich text exposes constrained font and size controls", () => {
  const full = renderToStaticMarkup(
    <RichTextEditor id="full-description" value="" onChange={() => undefined} ariaLabel="Volledige omschrijving" />
  );
  const short = renderToStaticMarkup(
    <RichTextEditor id="short-description" value="" onChange={() => undefined} ariaLabel="Korte omschrijving" profile="short" maxPlainTextLength={220} />
  );

  assert.match(full, /aria-label="Lettertype"/);
  assert.match(full, /aria-label="Tekstgrootte"/);
  assert.match(full, /aria-label="Alinea"/);
  assert.match(full, /aria-label="Link invoegen"/);
  assert.match(short, /aria-label="Lettertype"/);
  assert.match(short, /aria-label="Tekstgrootte"/);
  assert.doesNotMatch(short, /aria-label="Link invoegen"/);
  assert.doesNotMatch(short, /aria-label="Kop 2"/);
});

test("translation tabs support Arrow, Home and End keyboard navigation", () => {
  const module = translationsModule as unknown as {
    nextProductLocale?: (
      current: "nl" | "en" | "fr",
      key: "ArrowLeft" | "ArrowRight" | "Home" | "End"
    ) => "nl" | "en" | "fr";
  };

  assert.equal(typeof module.nextProductLocale, "function");
  if (!module.nextProductLocale) return;
  assert.equal(module.nextProductLocale("nl", "ArrowRight"), "en");
  assert.equal(module.nextProductLocale("nl", "ArrowLeft"), "fr");
  assert.equal(module.nextProductLocale("fr", "Home"), "nl");
  assert.equal(module.nextProductLocale("nl", "End"), "fr");
});

test("Maak van naam derives the slug from the active Crème translation", () => {
  const module = translationsModule as unknown as {
    translationWithSlugFromName?: (translation: {
      locale: "nl";
      name: string;
      slug: string;
      shortDescription: string;
      shortDescriptionHtml: string;
      description: string;
      descriptionHtml: string;
      seoTitle: string;
      metaDescription: string;
      promotionText: string;
    }) => { name: string; slug: string };
  };
  assert.equal(typeof module.translationWithSlugFromName, "function");
  if (!module.translationWithSlugFromName) return;

  const result = module.translationWithSlugFromName({
    locale: "nl",
    name: "Gemengde Bloemenhoning Crème",
    slug: "oude-slug",
    shortDescription: "",
    shortDescriptionHtml: "",
    description: "",
    descriptionHtml: "",
    seoTitle: "",
    metaDescription: "",
    promotionText: "",
  });
  assert.equal(result.name, "Gemengde Bloemenhoning Crème");
  assert.equal(result.slug, "gemengde-bloemenhoning-creme");
});
