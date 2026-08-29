import assert from "node:assert/strict";
import test from "node:test";
import { assessDataQuality } from "../lib/price-monitor/analysis";
import {
  extractBasBoerCategoryUrls,
  extractBasBoerProductUrls,
  parseBasBoerProductHtml,
} from "../lib/price-monitor/scrapers/bas-boer-parser";

test("parses Bas Boer Product JSON-LD into the shared monitor contract", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Gebrande amandelen 500 gram","description":"Vers gebrand","sku":"BB-500","gtin13":"8712345678901","offers":{"@type":"Offer","price":"6.95","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}]}
      </script>
    </head><body><h1>Verkeerde fallbacknaam</h1></body></html>`;

  const product = parseBasBoerProductHtml(
    html,
    "https://www.basboernoten.nl/noten/amandelen/gebrand"
  );

  assert.equal(product.sourceKey, "bas-boer");
  assert.equal(product.name, "Gebrande amandelen 500 gram");
  assert.equal(product.priceCents, 695);
  assert.equal(product.packageQuantity, 500);
  assert.equal(product.packageUnit, "GRAM");
  assert.equal(product.sku, "BB-500");
  assert.equal(product.ean, "8712345678901");
  assert.equal(product.inStock, true);
  assert.equal(product.priceSource, "STRUCTURED");
  assert.equal(assessDataQuality(product).safeForAnalysis, true);
});

test("extracts only allowed Bas Boer category and product links", () => {
  const homepage = `
    <a href="/noten">Noten</a>
    <a href="https://basboernoten.nl/gedroogd-fruit">Fruit</a>
    <a href="/noten?sort=price">Sortering</a>
    <a href="https://example.com/noten">Extern</a>`;
  assert.deepEqual(
    extractBasBoerCategoryUrls(homepage, "https://www.basboernoten.nl"),
    [
      "https://www.basboernoten.nl/noten",
      "https://basboernoten.nl/gedroogd-fruit",
    ]
  );

  const category = `
    <a href="/noten/amandelen/gebrand">Gebrande amandelen</a>
    <a href="/noten/cashewnoten">Cashewnoten</a>
    <a href="/contact/klantenservice">Contact</a>
    <a href="/image/cache/product.webp">Afbeelding</a>
    <a href="https://evil.example/noten/amandelen">Extern</a>`;
  assert.deepEqual(
    extractBasBoerProductUrls(category, "https://www.basboernoten.nl/noten"),
    [
      "https://www.basboernoten.nl/noten/amandelen/gebrand",
      "https://www.basboernoten.nl/noten/cashewnoten",
    ]
  );
});

test("visible shipping prices remain blocked from price actions", () => {
  const html = `<html><head><meta name="description" content="Zak van 500 gram"></head><body><h1>Walnoten</h1><p>Gratis verzending vanaf \u20ac 50,00</p></body></html>`;
  const product = parseBasBoerProductHtml(
    html,
    "https://www.basboernoten.nl/noten/walnoten"
  );
  const quality = assessDataQuality(product);

  assert.equal(product.priceSource, "VISIBLE_FALLBACK");
  assert.ok(quality.flags.includes("UNVERIFIED_PRICE_SOURCE"));
  assert.equal(quality.safeForAnalysis, false);
});

test("marks Bas Boer promotional markup as unsafe for price actions", () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Cashewnoten 500 gram","offers":{"@type":"Offer","price":"7.50","priceCurrency":"EUR"}}
      </script>
    </head><body><span class="price-old">\u20ac 9,50</span><span class="price-new">\u20ac 7,50</span></body></html>`;
  const product = parseBasBoerProductHtml(
    html,
    "https://www.basboernoten.nl/noten/cashewnoten"
  );
  const quality = assessDataQuality(product);

  assert.equal(product.priceCents, 750);
  assert.equal(product.isPromotionalPrice, true);
  assert.equal(product.raw?.basBoerPromotionalMarkup, true);
  assert.ok(quality.flags.includes("COMPETITOR_PROMOTION"));
  assert.equal(quality.safeForAnalysis, false);
});
