import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductDetailDto } from "../lib/queries";
import { ProductDetailContent } from "../components/product/ProductDetailContent";

const data: ProductDetailDto = {
  id: "product-1",
  sku: "AM-P",
  slug: "amandelen",
  name: "Amandelen",
  description: "Knapperige amandelen.",
  descriptionHtml: null,
  shortDescription: "Knapperige amandelen.",
  shortDescriptionHtml: null,
  seoTitle: null,
  metaDescription: null,
  promotionText: null,
  basePriceCents: 350,
  regularBasePriceCents: 350,
  salePriceCents: null,
  hasVariablePrice: false,
  currency: "EUR",
  unit: "WEIGHT",
  isActive: true,
  images: [],
  variants: [
    { id: "v-250", sku: "AM-250", priceCents: 350, regularPriceCents: 350, salePriceCents: null, stock: 2, weightGrams: 250, preparation: "RAW", salting: "UNSALTED", coating: "NONE", label: "250 gram" },
    { id: "v-500", sku: "AM-500", priceCents: 600, regularPriceCents: 600, salePriceCents: null, stock: 2, weightGrams: 500, preparation: "RAW", salting: "UNSALTED", coating: "NONE", label: "500 gram" },
  ],
  category: { slug: "noten", name: "Noten" },
  updatedAt: new Date("2026-08-18T00:00:00Z"),
  slugsByLocale: { nl: "amandelen" },
  attributes: [
    { key: "ingredients", value: "Amandelen" },
    { key: "allergens", value: "Noten" },
    { key: "mayContainTraces", value: "Pinda" },
    { key: "origin", value: "Spanje" },
    { key: "taste", value: "Mild en nootachtig" },
    { key: "usage", value: "Als snack of door de yoghurt" },
    { key: "storage", value: "Koel en droog bewaren" },
  ],
  recommendations: [],
};

test("renders breadcrumb, weight, price, availability and supplied food facts in HTML", () => {
  const html = renderToStaticMarkup(
    <ProductDetailContent data={data} locale="nl" initialVariantSku="AM-500" />
  );

  assert.match(html, /aria-label="Broodkruimel"/);
  assert.match(html, /href="\/nl\/categorie\/noten"/);
  assert.match(html, /250 gram/);
  assert.match(html, /Op voorraad/);
  assert.match(html, /€(?:\s|&nbsp;|\u00a0)3,50/);
  assert.match(html, /Ingrediënten/);
  assert.match(html, /Allergenen/);
  assert.match(html, /Kan sporen bevatten/);
  assert.match(html, /Herkomst[\s\S]*Spanje/);
  assert.match(html, /Smaak[\s\S]*Mild en nootachtig/);
  assert.match(html, /Gebruik[\s\S]*Als snack of door de yoghurt/);
  assert.match(html, /Bewaren[\s\S]*Koel en droog bewaren/);
  assert.match(html, /500 gram[\s\S]*?aria-checked="true"|aria-checked="true"[\s\S]*?500 gram/);
});

test("renders the same truthful fallback description used by structured data", () => {
  const html = renderToStaticMarkup(
    <ProductDetailContent
      data={{ ...data, description: null, descriptionHtml: null, shortDescription: null }}
      locale="nl"
    />
  );

  assert.match(html, /Amandelen van De Notenman uit de categorie Noten\./);
});

test("renders the stored safe short-description formatting on product detail", () => {
  const html = renderToStaticMarkup(
    <ProductDetailContent
      data={{
        ...data,
        shortDescriptionHtml: '<p>Vol en <strong>knapperig</strong> met <span data-rt-font="heading" data-rt-size="lg">karakter</span>.</p>',
      }}
      locale="nl"
    />
  );

  assert.match(html, /product-short-description/);
  assert.match(html, /<strong>knapperig<\/strong>/);
  assert.match(html, /data-rt-font="heading"/);
  assert.match(html, /data-rt-size="lg"/);
});
