import "server-only";

import { getPriceMonitorSource } from "@/lib/price-monitor/sources";
import type {
  PriceMonitorScraperAdapter,
  ScraperRunOptions,
} from "@/lib/price-monitor/scrapers/contracts";
import {
  extractBasBoerCategoryUrls,
  extractBasBoerProductUrls,
  isBasBoerProductUrl,
  parseBasBoerProductsHtml,
} from "@/lib/price-monitor/scrapers/bas-boer-parser";
import { parseSitemapUrls } from "@/lib/price-monitor/scrapers/noten-nl-parser";
import type { ScrapedCompetitorProduct } from "@/lib/price-monitor/types";

const source = getPriceMonitorSource("bas-boer");
if (!source) throw new Error("BAS_BOER_SOURCE_MISSING");
const SOURCE_BASE_URL = source.baseUrl;

const ALLOWED_HOSTS = new Set(["basboernoten.nl", "www.basboernoten.nl"]);
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_DISCOVERY_PAGES = 8;
const SCRAPE_CONCURRENCY = 2;
const REQUEST_DELAY_MS = 750;
const USER_AGENT =
  "DeNotenmanPriceMonitor/1.0 (+https://www.denotenman.com; bounded admin comparison)";

class BasBoerHttpError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 429
        ? "Bron gaf HTTP 429 en remt verzoeken tijdelijk af"
        : `Bron gaf HTTP ${status}`
    );
  }
}

export const basBoerAdapter: PriceMonitorScraperAdapter = {
  source,

  async discoverProductUrls(limit: number): Promise<string[]> {
    const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    try {
      const sitemapProducts = await discoverFromSitemap(boundedLimit);
      if (sitemapProducts.length > 0) return sitemapProducts;
    } catch (error) {
      if (
        error instanceof BasBoerHttpError &&
        [401, 403, 429].includes(error.status)
      ) {
        throw error;
      }
    }
    return discoverFromCategories(boundedLimit);
  },

  async scrapeProduct(url) {
    assertAllowedUrl(url);
    const products = parseBasBoerProductsHtml(await fetchText(url), url).filter(
      (product) => product.priceCents !== null
    );
    if (!products.length) {
      throw new Error("Geen betrouwbare productprijs gevonden");
    }
    return products;
  },

  async run(options: ScraperRunOptions) {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit)));
    await options.onProgress?.({
      phase: "DISCOVERING",
      current: 0,
      total: null,
      message: "Productpagina's bij Bas Boer zoeken",
    });
    const urls = await this.discoverProductUrls(limit);
    const products: ScrapedCompetitorProduct[] = [];
    const errors: Array<{ url: string; message: string }> = [];
    let nextIndex = 0;
    let processed = 0;
    const worker = async () => {
      while (nextIndex < urls.length) {
        const index = nextIndex;
        nextIndex += 1;
        const url = urls[index];
        try {
          products.push(...await this.scrapeProduct(url));
        } catch (error) {
          errors.push({
            url,
            message: error instanceof Error ? error.message : "Onbekende leesfout",
          });
        }
        processed += 1;
        await options.onProgress?.({
          phase: "SCRAPING",
          current: processed,
          total: urls.length,
          message: `Bas Boer-prijs ${processed} van ${urls.length} gecontroleerd`,
        });
        if (nextIndex < urls.length) await delay(REQUEST_DELAY_MS);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(SCRAPE_CONCURRENCY, urls.length) }, () => worker())
    );
    if (!urls.length) {
      await options.onProgress?.({
        phase: "SCRAPING",
        current: 0,
        total: 0,
        message: "Geen Bas Boer-productpagina's gevonden",
      });
    }
    return { discoveredCount: urls.length, products, errors };
  },
};

async function discoverFromSitemap(limit: number): Promise<string[]> {
  const rootXml = await fetchText(`${SOURCE_BASE_URL}/sitemap.xml`);
  const rootUrls = parseSitemapUrls(rootXml);
  const directProducts = rootUrls.filter(isBasBoerProductUrl);
  if (directProducts.length > 0) return unique(directProducts).slice(0, limit);

  const sitemapUrls = rootUrls
    .filter((url) => /sitemap/i.test(url))
    .slice(0, MAX_DISCOVERY_PAGES);
  const products: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);
    products.push(...parseSitemapUrls(xml).filter(isBasBoerProductUrl));
    if (unique(products).length >= limit) break;
    await delay(REQUEST_DELAY_MS);
  }
  return unique(products).slice(0, limit);
}

async function discoverFromCategories(limit: number): Promise<string[]> {
  const homepage = await fetchText(SOURCE_BASE_URL);
  const products = extractBasBoerProductUrls(homepage, SOURCE_BASE_URL);
  const categoryUrls = extractBasBoerCategoryUrls(homepage, SOURCE_BASE_URL)
    .slice(0, MAX_DISCOVERY_PAGES);
  for (const categoryUrl of categoryUrls) {
    if (unique(products).length >= limit) break;
    await delay(REQUEST_DELAY_MS);
    const categoryHtml = await fetchText(categoryUrl);
    products.push(...extractBasBoerProductUrls(categoryHtml, categoryUrl));
  }
  return unique(products).slice(0, limit);
}

async function fetchText(url: string): Promise<string> {
  let currentUrl = url;
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    assertAllowedUrl(currentUrl);
    response = await fetch(currentUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": USER_AGENT,
      },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirectCount === 3) throw new Error("Bron stuurde te veel omleidingen");
    currentUrl = new URL(location, currentUrl).toString();
  }
  if (!response) throw new Error("Bron gaf geen antwoord");
  if (!response.ok) throw new BasBoerHttpError(response.status);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Bronbestand is onverwacht groot");
  return readBoundedText(response, MAX_RESPONSE_BYTES);
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error("Bronbestand is onverwacht groot");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function assertAllowedUrl(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search
  ) {
    throw new Error("URL valt buiten de toegestane Bas Boer-bron");
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
