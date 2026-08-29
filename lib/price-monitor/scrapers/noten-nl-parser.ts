import { parsePackageSize, parsePriceCents } from "@/lib/price-monitor/analysis";
import type { ScrapedCompetitorProduct } from "@/lib/price-monitor/types";

type JsonRecord = Record<string, unknown>;

export function parseNotenNlProductHtml(
  html: string,
  sourceUrl: string
): ScrapedCompetitorProduct {
  return parseNotenNlProductsHtml(html, sourceUrl)[0];
}

export function parseNotenNlProductsHtml(
  html: string,
  sourceUrl: string
): ScrapedCompetitorProduct[] {
  const product = findJsonLdProduct(html);
  const offer = product ? findOffer(product.offers) : null;
  const name = firstString(
    product?.name,
    readMeta(html, "og:title"),
    readItemProp(html, "name"),
    readTagText(html, "h1"),
    readTagText(html, "title")
  );
  const description = firstString(
    product?.description,
    readMeta(html, "description"),
    readMeta(html, "og:description")
  );
  const structuredPrice = firstString(offer?.price, offer?.lowPrice);
  const itemPropPrice = readItemProp(html, "price");
  const metaPrice = readMeta(html, "product:price:amount");
  const visibleFallbackPrice = readVisibleEuroPrice(html);
  const priceValue = firstString(
    structuredPrice,
    itemPropPrice,
    metaPrice,
    visibleFallbackPrice
  );
  const priceSource = structuredPrice || itemPropPrice
    ? "STRUCTURED"
    : metaPrice
      ? "PRODUCT_META"
      : "VISIBLE_FALLBACK";
  const packageSize = parsePackageSize(`${name} ${description}`);
  const availability = firstString(offer?.availability, readItemProp(html, "availability"));
  const currency = firstString(
    offer?.priceCurrency,
    readItemProp(html, "priceCurrency"),
    readMeta(html, "product:price:currency")
  );
  const base = {
    sourceKey: "noten-nl",
    sourceUrl,
    externalKey: firstString(product?.productID, product?.sku) || sourceUrl,
    name: cleanText(name) || "Onbekend product",
    description: cleanText(description) || null,
    sku: firstString(product?.sku, product?.mpn) || null,
    ean: firstString(product?.gtin13, product?.gtin14, product?.gtin12, product?.gtin) || null,
    priceCents: parsePriceCents(priceValue),
    currency: currency.toUpperCase() || "EUR",
    packageQuantity: packageSize.quantity,
    packageUnit: packageSize.unit,
    inStock: availability
      ? !/outofstock|soldout|niet.?op.?voorraad/i.test(availability)
      : null,
    priceSource,
    raw: product
      ? { jsonLd: product, priceSource }
      : { parser: "html-fallback", priceSource },
  } satisfies ScrapedCompetitorProduct;
  const variations = readWooCommerceVariations(html);
  if (!variations.length) return [base];

  const parsedVariations = variations.flatMap((variation) => {
    const attributes = variation.attributes && typeof variation.attributes === "object"
      ? variation.attributes as JsonRecord
      : {};
    const optionLabel = Object.values(attributes)
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .trim();
    const packageSize = parsePackageSize(
      `${optionLabel} ${firstString(variation.variation_description, variation.weight_html)}`
    );
    const variationId = firstString(variation.variation_id, variation.id);
    const priceCents = parsePriceCents(firstString(variation.display_price, variation.price));
    const regularPriceCents = parsePriceCents(variation.display_regular_price);
    const isPromotionalPrice = Boolean(
      priceCents && regularPriceCents && priceCents < regularPriceCents
    );
    if (!variationId || !priceCents) return [];
    const variationUrl = `${sourceUrl.split("#")[0]}#variant-${encodeURIComponent(variationId)}`;
    return [{
      ...base,
      sourceUrl: variationUrl,
      externalKey: variationId,
      name: optionLabel ? `${base.name} — ${optionLabel}` : base.name,
      sku: firstString(variation.sku) || base.sku,
      ean: firstString(variation.gtin, variation.gtin13) || base.ean,
      priceCents,
      packageQuantity: packageSize.quantity,
      packageUnit: packageSize.unit,
      isPromotionalPrice,
      priceSource: "WOO_VARIATION",
      inStock: typeof variation.is_in_stock === "boolean"
        ? variation.is_in_stock
        : base.inStock,
      raw: {
        variation,
        parentJsonLd: product,
        priceSource: "WOO_VARIATION",
        regularPriceCents,
        isPromotionalPrice,
      },
    } satisfies ScrapedCompetitorProduct];
  });
  return parsedVariations.length ? parsedVariations : [base];
}

export function parseSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeHtml(match[1].trim()))
    .filter((url) => /^https:\/\//i.test(url));
}

function findJsonLdProduct(html: string): JsonRecord | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script[1].trim())) as unknown;
      const found = findType(parsed, "Product");
      if (found) return found;
    } catch {
      // Invalid JSON-LD is common; the bounded HTML fallbacks below remain safe.
    }
  }
  return null;
}

function findType(value: unknown, wanted: string): JsonRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findType(item, wanted);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  const type = record["@type"];
  if (type === wanted || (Array.isArray(type) && type.includes(wanted))) return record;
  for (const nested of Object.values(record)) {
    const found = findType(nested, wanted);
    if (found) return found;
  }
  return null;
}

function findOffer(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) {
    return value.find((item) => item && typeof item === "object") as JsonRecord | null;
  }
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function readWooCommerceVariations(html: string): JsonRecord[] {
  const match = html.match(/data-product_variations\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!match?.[2]) return [];
  try {
    const parsed = JSON.parse(decodeHtml(match[2])) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object")
      : [];
  } catch {
    return [];
  }
}

function readMeta(html: string, key: string): string {
  const escaped = escapeRegExp(key);
  const direct = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i")
  );
  const reverse = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  );
  return decodeHtml((direct || reverse)?.[1] || "");
}

function readItemProp(html: string, key: string): string {
  const escaped = escapeRegExp(key);
  const tag = html.match(new RegExp(`<[^>]+itemprop=["']${escaped}["'][^>]*>`, "i"))?.[0];
  if (!tag) return "";
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  if (content) return decodeHtml(content);
  const fullTag = html.match(
    new RegExp(`<([a-z0-9]+)[^>]+itemprop=["']${escaped}["'][^>]*>([^]*?)<\/\\1>`, "i")
  );
  return fullTag ? cleanText(fullTag[2]) : "";
}

function readTagText(html: string, tagName: string): string {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([^]*?)<\/${tagName}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function readVisibleEuroPrice(html: string): string {
  const text = cleanText(html);
  return text.match(/\u20ac\s*\d+(?:[.,]\d{1,2})?/i)?.[0] || "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return decodeHtml(value.trim());
  }
  return "";
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return decoded;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
