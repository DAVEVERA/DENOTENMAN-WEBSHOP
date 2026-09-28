import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCard } from "../components/product/ProductCard";
import type { CatalogProductDto } from "../lib/queries";
import { product as productPath } from "../lib/routes";

function catalogProduct(overrides: Partial<CatalogProductDto> = {}): CatalogProductDto {
  return {
    id: "product-1",
    slug: "gebrande-cashewnoten",
    name: "Gebrande cashewnoten",
    shortDescription: null,
    basePriceCents: 495,
    regularBasePriceCents: 495,
    salePriceCents: null,
    hasVariablePrice: false,
    isActive: true,
    images: [],
    category: null,
    ...overrides,
  };
}

function productLinks(markup: string, href: string): string[] {
  return markup.match(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`, "gs")) ?? [];
}

test("an orderable product card links image, title and Bestel nu to the product page and has no quick order", () => {
  const product = catalogProduct({
    images: [
      {
        url: "/products/cashew.webp",
        alt: "Cashewnoten in een schaal",
        isPrimary: true,
      },
    ],
  });
  const markup = renderToStaticMarkup(<ProductCard product={product} locale="nl" />);
  const links = productLinks(markup, productPath("nl", product.slug));

  assert.ok(!markup.includes("Snel bestellen"));
  assert.ok(!markup.includes("Meer info"));
  assert.ok(!markup.includes("Open snelle productinformatie"));
  assert.equal(links.length, 2);
  // Image and title share one link that stays out of the tab order.
  assert.ok(links[0].includes('tabindex="-1"'));
  assert.ok(links[0].includes('alt="Cashewnoten in een schaal"'));
  assert.ok(links[0].includes("Gebrande cashewnoten"));
  // The CTA is the single keyboard-focusable link.
  assert.ok(!links[1].includes('tabindex="-1"'));
  assert.ok(links[1].includes("<span>Bestel nu</span>"));
  assert.ok(links[1].includes("min-h-11"));
  // Only the favorite toggle remains as a button; nothing opens a quick view.
  assert.equal((markup.match(/<button\b/g) ?? []).length, 1);
  assert.ok(markup.includes('aria-label="Toevoegen aan favorieten"'));
});

test("the order CTA follows the card locale", () => {
  const product = catalogProduct();

  const en = renderToStaticMarkup(<ProductCard product={product} locale="en" />);
  const fr = renderToStaticMarkup(<ProductCard product={product} locale="fr" />);

  assert.ok(en.includes("<span>Order now</span>"));
  assert.ok(!en.includes("Quick order"));
  assert.ok(fr.includes("<span>Commander maintenant</span>"));
  assert.ok(!fr.includes("Commander rapidement"));
});

test("an unavailable product card keeps the stock alert and never offers Bestel nu", () => {
  const product = catalogProduct({ isActive: false });
  const markup = renderToStaticMarkup(<ProductCard product={product} locale="nl" />);
  const links = productLinks(markup, productPath("nl", product.slug));

  assert.ok(markup.includes("Niet op voorraad"));
  assert.ok(!markup.includes("Bestel nu"));
  assert.ok(!markup.includes("Snel bestellen"));
  assert.equal(links.length, 3);
  assert.ok(links[0].includes("Gebrande cashewnoten"));
  assert.ok(links[1].includes("Geef me een seintje"));
  assert.ok(links[2].includes("<span>Meer info</span>"));
});
