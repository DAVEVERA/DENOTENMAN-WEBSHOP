import "server-only";

import { getPriceMonitorSource } from "@/lib/price-monitor/sources";
import type {
  PriceMonitorScraperAdapter,
  ScraperRunOptions,
} from "@/lib/price-monitor/scrapers/contracts";
import {
  parseNotenNlProductsHtml,
  parseSitemapUrls,
} from "@/lib/price-monitor/scrapers/noten-nl-parser";
import type { ScrapedCompetitorProduct } from "@/lib/price-monitor/types";

const source = getPriceMonitorSource("noten-nl");
if (!source) throw new Error("NOTEN_NL_SOURCE_MISSING");

const PRODUCT_PATH_HINTS = ["/noten/", "/gedroogd-fruit/", "/p/", "/product/", "/item/"];
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const SCRAPE_CONCURRENCY = 3;
const USER_AGENT =
  "DeNotenmanPriceMonitor/1.0 (+https://www.denotenman.nl; bounded admin comparison)";

export const notenNlAdapter: PriceMonitorScraperAdapter = {
  source,

  async discoverProductUrls(limit: number): Promise<string[]> {
    const rootXml = await fetchText(`${source.baseUrl}/sitemap.xml`);
    const rootUrls = parseSitemapUrls(rootXml);
    const directProducts = rootUrls.filter(isProductUrl);
    if (directProducts.length > 0) return unique(directProducts).slice(0, limit);

    const sitemapUrls = rootUrls
      .filter((url) => /sitemap/i.test(url))
      .sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a)))
      .slice(0, 12);
    const products: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const xml = await fetchText(sitemapUrl);
      products.push(...parseSitemapUrls(xml).filter(isProductUrl));
      if (unique(products).length >= limit) break;
      await delay(150);
    }
    return unique(products).slice(0, limit);
  },

  async scrapeProduct(url) {
    assertAllowedUrl(url);
    return parseNotenNlProductsHtml(await fetchText(url), url);
  },

  async run(options: ScraperRunOptions) {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit)));
    await options.onProgress?.({
      phase: "DISCOVERING",
      current: 0,
      total: null,
      message: "Productpagina's zoeken",
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
          message: `Prijs ${processed} van ${urls.length} gecontroleerd`,
        });
        if (nextIndex < urls.length) await delay(450);
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
        message: "Geen productpagina's gevonden",
      });
    }
    return { discoveredCount: urls.length, products, errors };
  },
};

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
  if (!response.ok) throw new Error(`Bron gaf HTTP ${response.status}`);
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
  if (url.protocol !== "https:" || !/(^|\.)noten\.nl$/i.test(url.hostname)) {
    throw new Error("URL valt buiten Noten.nl");
  }
}

function isProductUrl(url: string): boolean {
  try {
    assertAllowedUrl(url);
    return PRODUCT_PATH_HINTS.some((hint) => new URL(url).pathname.includes(hint));
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
