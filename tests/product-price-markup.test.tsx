import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductPrice } from "../components/product/ProductPrice";

test("shows v.a. only for a product with differing effective variant prices", () => {
  const variableMarkup = renderToStaticMarkup(
    <ProductPrice
      locale="nl"
      product={{
        basePriceCents: 495,
        regularBasePriceCents: 595,
        salePriceCents: 495,
        hasVariablePrice: true,
      }}
    />
  );
  const fixedMarkup = renderToStaticMarkup(
    <ProductPrice
      locale="nl"
      product={{
        basePriceCents: 495,
        regularBasePriceCents: 495,
        salePriceCents: null,
        hasVariablePrice: false,
      }}
    />
  );

  assert.match(variableMarkup, /v\.a\./);
  assert.match(variableMarkup, /Vanaf/);
  assert.doesNotMatch(fixedMarkup, /v\.a\.|Vanaf/);
});
