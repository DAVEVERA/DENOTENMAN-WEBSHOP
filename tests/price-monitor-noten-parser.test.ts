import assert from "node:assert/strict";
import test from "node:test";
import {
  parseNotenNlProductHtml,
  parseNotenNlProductsHtml,
  parseSitemapUrls,
} from "../lib/price-monitor/scrapers/noten-nl-parser";
import { assessDataQuality } from "../lib/price-monitor/analysis";

test("parses Noten.nl-style Product JSON-LD before generic HTML", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Pistachenoten ongepeld 500 gram","description":"Vers en ongebrand","sku":"PIS-500","gtin13":"8712345678901","offers":{"@type":"Offer","price":"9.95","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}
      </script>
    </head><body><h1>Verkeerde fallbacknaam</h1></body></html>`;
  const product = parseNotenNlProductHtml(html, "https://www.noten.nl/noten/pistachenoten");
  assert.equal(product.name, "Pistachenoten ongepeld 500 gram");
  assert.equal(product.priceCents, 995);
  assert.equal(product.packageQuantity, 500);
  assert.equal(product.packageUnit, "GRAM");
  assert.equal(product.sku, "PIS-500");
  assert.equal(product.ean, "8712345678901");
  assert.equal(product.inStock, true);
});

test("uses bounded HTML fallbacks when JSON-LD is missing", () => {
  const html = `<html><head><meta name="description" content="Zak van 250 gram"><meta property="product:price:amount" content="4,25"><meta property="product:price:currency" content="EUR"></head><body><h1>Amandelen ongebrand</h1></body></html>`;
  const product = parseNotenNlProductHtml(html, "https://www.noten.nl/noten/amandelen");
  assert.equal(product.name, "Amandelen ongebrand");
  assert.equal(product.priceCents, 425);
  assert.equal(product.packageQuantity, 250);
});

test("extracts and decodes sitemap URLs", () => {
  assert.deepEqual(
    parseSitemapUrls(`<urlset><url><loc>https://www.noten.nl/noten/a&amp;b</loc></url></urlset>`),
    ["https://www.noten.nl/noten/a&b"]
  );
});

test("expands WooCommerce variations into separately comparable packages", () => {
  const variations = JSON.stringify([
    { variation_id: 5100, display_price: 3.7, is_in_stock: true, attributes: { attribute_inhoud: "250 gram" } },
    { variation_id: 5126, display_price: 6.4, is_in_stock: true, attributes: { attribute_inhoud: "500 gram" } },
    { variation_id: 5127, display_price: 11.75, is_in_stock: true, attributes: { attribute_inhoud: "1 kilo" } },
    { variation_id: 5128, display_price: 105, is_in_stock: true, attributes: { attribute_inhoud: "bulk" } },
  ]).replace(/"/g, "&quot;");
  const html = `<html><head><meta property="product:price:currency" content="EUR"></head><body><h1>Pittenmix</h1><form class="variations_form" data-product_variations="${variations}"></form></body></html>`;
  const products = parseNotenNlProductsHtml(html, "https://noten.nl/p/pittenmix");
  assert.equal(products.length, 4);
  assert.deepEqual(
    products.slice(0, 3).map((product) => [product.priceCents, product.packageQuantity, product.packageUnit]),
    [[370, 250, "GRAM"], [640, 500, "GRAM"], [1175, 1000, "GRAM"]]
  );
  assert.equal(products[3].packageQuantity, null);
  assert.equal(products[0].sourceUrl, "https://noten.nl/p/pittenmix#variant-5100");
});

test("marks a WooCommerce sale as a promotion that cannot drive a price action", () => {
  const variations = JSON.stringify([
    {
      variation_id: 6100,
      display_price: 7.5,
      display_regular_price: 9.5,
      is_in_stock: true,
      attributes: { attribute_inhoud: "500 gram" },
    },
  ]).replace(/"/g, "&quot;");
  const html = `<html><head><meta name="description" content="Zak van 500 gram"><meta property="product:price:currency" content="EUR"></head><body><h1>Amandelen</h1><form data-product_variations="${variations}"></form></body></html>`;
  const [product] = parseNotenNlProductsHtml(html, "https://noten.nl/p/amandelen");
  const quality = assessDataQuality(product);
  assert.equal(product.priceCents, 750);
  assert.equal(product.isPromotionalPrice, true);
  assert.equal(product.raw?.regularPriceCents, 950);
  assert.ok(quality.flags.includes("COMPETITOR_PROMOTION"));
  assert.equal(quality.safeForAnalysis, false);
});

test("blocks an unverified first-visible-euro fallback from analysis", () => {
  const html = `<html><head><meta name="description" content="Zak van 500 gram"></head><body><h1>Walnoten</h1><p>Gratis verzending vanaf € 39,00</p></body></html>`;
  const product = parseNotenNlProductHtml(html, "https://noten.nl/p/walnoten");
  const quality = assessDataQuality(product);
  assert.equal(product.priceSource, "VISIBLE_FALLBACK");
  assert.ok(quality.flags.includes("UNVERIFIED_PRICE_SOURCE"));
  assert.equal(quality.safeForAnalysis, false);
});
