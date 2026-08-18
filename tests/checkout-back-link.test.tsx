import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutBackLink } from "../components/checkout/CheckoutBackLink";
import nl from "../dictionaries/nl.json";
import en from "../dictionaries/en.json";
import fr from "../dictionaries/fr.json";

const cases = [
  { locale: "nl" as const, dictionary: nl },
  { locale: "en" as const, dictionary: en },
  { locale: "fr" as const, dictionary: fr },
];

test("checkout back link points to the localized cart", () => {
  for (const { locale, dictionary } of cases) {
    const markup = renderToStaticMarkup(
      <CheckoutBackLink locale={locale} label={dictionary.checkout.backToCart} />
    );

    assert.match(markup, new RegExp(`href="/${locale}/cart"`));
    assert.match(markup, new RegExp(`>${dictionary.checkout.backToCart}</span>`));
  }
});

test("checkout back link has mobile touch and interaction affordances", () => {
  const markup = renderToStaticMarkup(
    <CheckoutBackLink locale="nl" label={nl.checkout.backToCart} />
  );

  assert.match(markup, /min-h-11/);
  assert.match(markup, /max-w-full/);
  assert.match(markup, /touch-manipulation/);
  assert.match(markup, /hover:bg-background/);
  assert.match(markup, /active:bg-border/);
});
