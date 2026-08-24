import assert from "node:assert/strict";
import test from "node:test";
import type { ProductDetailDto } from "../lib/queries";
import {
  buildGoogleMerchantFeedXml,
  buildProductStructuredData,
  isStorefrontVariantOrderable,
  variantSelectionUrl,
} from "../lib/structured-data";

const product: ProductDetailDto = {
  id: "product-1",
  sku: "AM-P",
  slug: "amandelen",
  name: "Amandelen & meer",
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
  hasVariablePrice: true,
  currency: "EUR",
  unit: "WEIGHT",
  isActive: true,
  images: [{ url: "https://images.example/amandelen.webp", alt: "Amandelen", isPrimary: true }],
  variants: [
    { id: "v-250", sku: "AM-250", priceCents: 350, regularPriceCents: 350, salePriceCents: null, stock: 8, weightGrams: 250, preparation: "RAW", salting: "UNSALTED", coating: "NONE", label: "250 gram" },
    { id: "v-500", sku: "AM-500", priceCents: 600, regularPriceCents: 600, salePriceCents: null, stock: 0, weightGrams: 500, preparation: "RAW", salting: "UNSALTED", coating: "NONE", label: "500 gram" },
  ],
  category: { slug: "noten", name: "Noten" },
  updatedAt: new Date("2026-08-18T00:00:00Z"),
  slugsByLocale: { nl: "amandelen" },
  attributes: [],
  recommendations: [],
};

test("builds ProductGroup variants, breadcrumb and Organization from storefront DTO data", () => {
  const jsonLd = buildProductStructuredData({
    product,
    locale: "nl",
    baseUrl: "https://denotenman.com",
  });
  const graph = jsonLd["@graph"] as Array<Record<string, any>>;
  const organization = graph.find((entry) => entry["@type"] === "Organization");
  const breadcrumb = graph.find((entry) => entry["@type"] === "BreadcrumbList");
  const group = graph.find((entry) => entry["@type"] === "ProductGroup");

  assert.equal(organization?.name, "De Notenman");
  assert.equal(organization?.logo, "https://denotenman.com/brand/logo-wordmark.svg");
  assert.equal(organization?.hasShippingService?.["@id"], "https://denotenman.com#standard-shipping");
  assert.equal(organization?.hasShippingService?.shippingConditions?.length, 4);
  assert.deepEqual(organization?.hasMerchantReturnPolicy?.applicableCountry, ["NL", "BE"]);
  assert.equal(organization?.hasMerchantReturnPolicy?.merchantReturnDays, 14);
  assert.equal(
    organization?.hasMerchantReturnPolicy?.itemCondition,
    "https://schema.org/NewCondition"
  );
  assert.equal(breadcrumb?.itemListElement?.[1]?.name, "Noten");
  assert.equal(group?.productGroupID, "AM-P");
  assert.equal(group?.hasVariant?.length, 2);
  assert.equal(group?.hasVariant?.[0]?.offers.availability, "https://schema.org/InStock");
  assert.equal(group?.hasVariant?.[1]?.offers.availability, "https://schema.org/OutOfStock");
  for (const variant of group?.hasVariant ?? []) {
    assert.equal(variant.offers.shippingDetails["@type"], "OfferShippingDetails");
    assert.equal(
      variant.offers.shippingDetails.hasShippingService["@id"],
      "https://denotenman.com#standard-shipping"
    );
  }
  assert.equal(
    group?.hasVariant?.[0]?.offers.hasMerchantReturnPolicy["@id"],
    "https://denotenman.com#return-policy"
  );
  assert.match(group?.hasVariant?.[0]?.description, /Verpakking: 250 gram\./);
  assert.equal(
    group?.hasVariant?.[1]?.offers.url,
    "https://denotenman.com/nl/producten/amandelen?variant=AM-500"
  );
  assert.equal(
    group?.hasVariant?.[1]?.url,
    "https://denotenman.com/nl/producten/amandelen?variant=AM-500"
  );
  assert.equal(
    group?.hasVariant?.[1]?.["@id"],
    "https://denotenman.com/nl/producten/amandelen?variant=AM-500#product"
  );

  const serialized = JSON.stringify(jsonLd);
  assert.doesNotMatch(serialized, /aggregateRating|"review"|gtin|mpn|origin/i);
});

test("supplies a visible-safe localized description when product copy is missing", () => {
  const jsonLd = buildProductStructuredData({
    product: {
      ...product,
      description: null,
      descriptionHtml: null,
      shortDescription: null,
    },
    locale: "nl",
    baseUrl: "https://denotenman.com",
  });
  const group = (jsonLd["@graph"] as Array<Record<string, any>>).find(
    (entry) => entry["@type"] === "ProductGroup"
  );

  assert.equal(group?.description, "Amandelen & meer van De Notenman uit de categorie Noten.");
  assert.match(group?.hasVariant?.[0]?.description, /Verpakking: 250 gram\./);
});

test("uses the same orderability rule for JSON-LD and Merchant availability", () => {
  assert.equal(isStorefrontVariantOrderable(true, { stock: 1 }), true);
  assert.equal(isStorefrontVariantOrderable(true, { stock: 0 }), false);
  assert.equal(isStorefrontVariantOrderable(false, { stock: 10 }), false);
});

test("builds a well-formed RSS Merchant feed item per visible variant", () => {
  const xml = buildGoogleMerchantFeedXml({
    products: [product],
    locale: "nl",
    baseUrl: "https://denotenman.com",
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0" version="2\.0">/);
  assert.equal((xml.match(/<item>/g) ?? []).length, 2);
  assert.match(xml, /<title>Amandelen &amp; meer - 250 gram<\/title>/);
  assert.match(xml, /<g:item_group_id>AM-P<\/g:item_group_id>/);
  assert.match(xml, /variant=AM-500/);
  assert.match(xml, /<g:availability>in_stock<\/g:availability>/);
  assert.match(xml, /<g:availability>out_of_stock<\/g:availability>/);
  assert.doesNotMatch(xml, /<g:(?:gtin|mpn|shipping)>/);
  assert.equal((xml.match(/<g:identifier_exists>no<\/g:identifier_exists>/g) ?? []).length, 2);
});

test("encodes a variant SKU into a directly selectable product URL", () => {
  assert.equal(
    variantSelectionUrl("https://denotenman.com/", "nl", "amandelen", "AM 250/+"),
    "https://denotenman.com/nl/producten/amandelen?variant=AM+250%2F%2B"
  );
});
