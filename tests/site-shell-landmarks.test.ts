import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the storefront skip link targets content between the global header and footer", async () => {
  const [layout, shell, dutchProductLayout, frenchProductLayout] = await Promise.all([
    readFile("app/[locale]/layout.tsx", "utf8"),
    readFile("components/layout/SiteShell.tsx", "utf8"),
    readFile("app/[locale]/producten/[product]/layout.tsx", "utf8"),
    readFile("app/[locale]/produits/[product]/layout.tsx", "utf8"),
  ]);

  assert.match(layout, /href="#main-content"/);
  assert.doesNotMatch(layout, /<main id="main-content">/);
  assert.match(
    shell,
    /<Header[\s\S]*<main id="main-content">\{children\}<\/main>[\s\S]*<Footer/
  );
  assert.match(dutchProductLayout, /products\/\[product\]\/layout/);
  assert.match(frenchProductLayout, /products\/\[product\]\/layout/);
});
