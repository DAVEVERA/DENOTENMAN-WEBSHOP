import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ProductCard } from "../components/product/ProductCard";
import type { CatalogProductDto } from "../lib/queries";
import { product as productPath } from "../lib/routes";

const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
} as unknown as React.ContextType<typeof AppRouterContext>;

function render(node: ReactNode): string {
  return renderToStaticMarkup(<AppRouterContext.Provider value={router}>{node}</AppRouterContext.Provider>);
}

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
    images: [{ url: "/products/cashew.webp", alt: "Cashewnoten in een schaal", isPrimary: true, cardUrl: null }],
    category: null,
    ...overrides,
  };
}

function productLinks(markup: string, href: string): string[] {
  return markup.match(new RegExp(`<a[^>]*href="${href}"[^>]*>.*?</a>`, "gs")) ?? [];
}

test("the card image and title link to the product detail page instead of the quick view", () => {
  const product = catalogProduct();
  const markup = render(<ProductCard product={product} locale="nl" />);
  const links = productLinks(markup, productPath("nl", product.slug));

  assert.equal(links.length, 2);
  assert.ok(links[0].includes('tabindex="-1"'));
  assert.ok(links[0].includes('alt="Cashewnoten in een schaal"'));
  assert.ok(links[0].includes("Gebrande cashewnoten"));
  assert.ok(!links[0].includes("Open snelle productinformatie"));
  assert.ok(links[1].includes("<span>Meer info</span>"));
});

test("an orderable card keeps the quick order button", () => {
  const markup = render(<ProductCard product={catalogProduct()} locale="nl" />);

  assert.ok(markup.includes("Snel bestellen"));
  assert.ok(markup.includes('aria-label="Open snelle productinformatie voor Gebrande cashewnoten"'));
  assert.ok(!markup.includes("Bestel nu"));
  // Favorite toggle plus the quick order button; the image and title are a link now.
  assert.equal((markup.match(/<button\b/g) ?? []).length, 2);
});

test("an unavailable card keeps the stock alert and more info links", () => {
  const product = catalogProduct({ isActive: false });
  const markup = render(<ProductCard product={product} locale="nl" />);
  const links = productLinks(markup, productPath("nl", product.slug));

  assert.ok(!markup.includes("Snel bestellen"));
  assert.equal(links.length, 3);
  assert.ok(links[1].includes("Geef me een seintje"));
  assert.ok(links[2].includes("<span>Meer info</span>"));
});

test("a click elsewhere on the card opens the detail page and never the quick view", () => {
  const source = readFileSync("components/product/ProductCard.tsx", "utf8");
  const cardClick = source.slice(source.indexOf("onClick={(event) =>"), source.indexOf("<Link"));

  assert.match(cardClick, /closest\("button, a"\)/);
  assert.match(cardClick, /router\.push\(detailHref\)/);
  assert.doesNotMatch(cardClick, /openQuickView/);
});

test("a card with a pipeline variant serves that variant instead of the optimizer", () => {
  const markup = render(
    <ProductCard
      product={catalogProduct({
        images: [
          {
            url: "https://storage.googleapis.com/notenbucket/products/cashew/original.png",
            alt: "Cashewnoten in een schaal",
            isPrimary: true,
            cardUrl: "https://storage.googleapis.com/notenbucket/products/p1/derived/circle-center-v1/i1/r1/card.webp",
          },
        ],
      })}
      locale="nl"
    />
  );

  assert.ok(markup.includes("derived/circle-center-v1/i1/r1/card.webp"));
  // Served straight from storage: no Cloud Run conversion, and no focal
  // transform on an already centred square crop.
  assert.ok(!markup.includes("/_next/image"));
  assert.ok(!markup.includes("--focal-zoom"));
});

test("a card without a pipeline variant still goes through the optimizer with its focal crop", () => {
  const markup = render(
    <ProductCard
      product={catalogProduct({
        images: [
          {
            url: "/products/cashew.png",
            alt: "Cashewnoten in een schaal",
            isPrimary: true,
            cardUrl: null,
          },
        ],
      })}
      locale="nl"
    />
  );

  assert.ok(markup.includes("/_next/image"));
  assert.ok(markup.includes("--focal-zoom"));
});
