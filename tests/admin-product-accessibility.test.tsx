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

  assert.doesNotMatch(toolbar, /min-h-10|min-w-10/);
  assert.match(toolbar, /min-h-11 min-w-11/);
  assert.doesNotMatch(nutrition, /min-h-10/);
  assert.match(logout, /min-h-11/);
  assert.match(navigationSource, /min-h-11/);
  assert.match(productPageSource, /min-h-11/);
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
