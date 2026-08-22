import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductQuickViewAddedActions } from "../components/product/ProductQuickView";

const labels = {
  added: "Toegevoegd aan je winkelwagen",
  goToCart: "Naar winkelwagen",
  continueShopping: "Verder winkelen",
};

test("the added state confirms the selected product and exposes exactly two next steps", () => {
  const markup = renderToStaticMarkup(
    <ProductQuickViewAddedActions
      locale="nl"
      productName="Chocolade amandelen"
      quantity={2}
      labels={labels}
      onContinue={() => {}}
    />
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /Toegevoegd aan je winkelwagen/);
  assert.match(markup, /2× Chocolade amandelen/);
  assert.match(markup, /href="\/nl\/cart"/);
  assert.doesNotMatch(markup, /href="\/nl\/checkout"/);
  assert.match(markup, />Naar winkelwagen<\/span>/);
  assert.match(markup, /type="button"[^>]*>.*Verder winkelen/s);
  assert.equal((markup.match(/<(?:a|button)\b/g) ?? []).length, 2);
});

test("both follow-up actions remain full-size and stack on narrow mobile screens", () => {
  const markup = renderToStaticMarkup(
    <ProductQuickViewAddedActions
      locale="nl"
      productName="Chocolade amandelen"
      quantity={1}
      labels={labels}
      onContinue={() => {}}
    />
  );

  assert.match(markup, /grid-cols-1/);
  assert.match(markup, /min-\[400px\]:grid-cols-2/);
  assert.equal((markup.match(/min-h-12/g) ?? []).length, 2);
});
