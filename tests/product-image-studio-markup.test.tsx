import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductImageStudio } from "../components/admin-panel/ProductImageStudio";

test("the image studio does not render a nested form inside the product form", () => {
  const html = renderToStaticMarkup(
    <ProductImageStudio
      productId="product_1"
      productName="Amandelen"
      initialImages={[
        {
          id: "image_1",
          url: "https://example.com/amandelen.png",
          alt: "Amandelen",
          sortOrder: 0,
          isPrimary: true,
        },
      ]}
    />
  );

  assert.doesNotMatch(
    html,
    /<form\b/i,
    "ProductImageStudio is rendered inside ProductAdminForm and therefore cannot contain another form"
  );
});

test("the image studio exposes progress, selection and an accessible empty state", () => {
  const populated = renderToStaticMarkup(
    <ProductImageStudio
      productId="product_1"
      productName="Amandelen"
      initialImages={[{ id: "image_1", url: "https://example.com/amandelen.png", alt: "Amandelen", sortOrder: 0, isPrimary: true }]}
    />
  );
  const empty = renderToStaticMarkup(
    <ProductImageStudio productId="product_1" productName="Amandelen" initialImages={[]} />
  );

  assert.match(populated, /aria-busy="false"/);
  assert.match(populated, /aria-pressed="true"/);
  assert.match(populated, /loading="lazy"/);
  assert.match(populated, /decoding="async"/);
  assert.match(populated, /focus-within:/);
  assert.match(empty, /Nog geen productafbeeldingen/);
});
