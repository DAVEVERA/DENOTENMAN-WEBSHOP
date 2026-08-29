import {
  parseNotenNlProductHtml,
  parseNotenNlProductsHtml,
} from "@/lib/price-monitor/scrapers/noten-nl-parser";
import type { ScrapedCompetitorProduct } from "@/lib/price-monitor/types";

const ALLOWED_HOSTS = new Set(["basboernoten.nl", "www.basboernoten.nl"]);
const CATEGORY_PATH_HINTS = [
  "/noten",
  "/pitten-zaden",
  "/gedroogd-fruit",
  "/chocolade",
  "/muesli-granen",
  "/bakproducten",
];
const IGNORED_PRODUCT_PATHS = [
  "/account",
  "/blog",
  "/cart",
  "/catalog",
  "/checkout",
  "/contact",
  "/image",
  "/informatie",
  "/javascript",
];

export function parseBasBoerProductHtml(
  html: string,
  sourceUrl: string
): ScrapedCompetitorProduct {
  return asBasBoerProduct(parseNotenNlProductHtml(html, sourceUrl), html);
}

export function parseBasBoerProductsHtml(
  html: string,
  sourceUrl: string
): ScrapedCompetitorProduct[] {
  return parseNotenNlProductsHtml(html, sourceUrl).map((product) =>
    asBasBoerProduct(product, html)
  );
}

function asBasBoerProduct(
  product: ScrapedCompetitorProduct,
  html: string
): ScrapedCompetitorProduct {
  const hasPromotionalMarkup =
    /class\s*=\s*(["'])[^"']*(?:price-old|price-new|special-price)[^"']*\1|<del\b|aanbiedingsprijs/i.test(
      html
    );
  return {
    ...product,
    sourceKey: "bas-boer",
    isPromotionalPrice:
      product.isPromotionalPrice || hasPromotionalMarkup || undefined,
    raw: {
      ...product.raw,
      basBoerPromotionalMarkup: hasPromotionalMarkup,
    },
  };
}

export function extractBasBoerCategoryUrls(html: string, baseUrl: string): string[] {
  return extractAllowedLinks(html, baseUrl).filter((url) => {
    const pathname = new URL(url).pathname.toLowerCase();
    return CATEGORY_PATH_HINTS.some(
      (hint) => pathname === hint || pathname.startsWith(`${hint}/`)
    );
  });
}

export function extractBasBoerProductUrls(html: string, baseUrl: string): string[] {
  return extractAllowedLinks(html, baseUrl).filter(isBasBoerProductUrl);
}

export function isBasBoerProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!isAllowedBasBoerUrl(url)) return false;
    const pathname = url.pathname.toLowerCase();
    if (IGNORED_PRODUCT_PATHS.some((prefix) => pathname.startsWith(prefix))) return false;
    return pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function extractAllowedLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const href = decodeHtml(match[2].trim());
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(href)) continue;
    try {
      const url = new URL(href, baseUrl);
      if (!isAllowedBasBoerUrl(url)) continue;
      url.hash = "";
      links.push(url.toString());
    } catch {
      // Malformed links from the source are ignored, not followed.
    }
  }
  return [...new Set(links)];
}

function isAllowedBasBoerUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    ALLOWED_HOSTS.has(url.hostname.toLowerCase()) &&
    !url.username &&
    !url.password &&
    (!url.port || url.port === "443") &&
    !url.search
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}
