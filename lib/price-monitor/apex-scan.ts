import apexScanRaw from "@/app/admin/(dashboard)/prijsmonitor/apex_scan_20260830_210808.json";
import type {
  PriceMonitorApexScanItem,
  PriceMonitorApexScanPage,
  PriceMonitorApexScanSource,
  PriceMonitorApexScanSummary,
} from "@/lib/price-monitor/types";

type RawApexVariant = {
  title?: unknown;
  price?: unknown;
  compare_price?: unknown;
  sku?: unknown;
  unit?: unknown;
  unit_price?: unknown;
};

type RawApexProduct = {
  url?: unknown;
  name?: unknown;
  price?: unknown;
  variants?: unknown;
  sku?: unknown;
};

const SCAN_ID = "apex-20260830-210808";
const SCRAPER_FILE = "app/admin/(dashboard)/prijsmonitor/apex.py";
const RESULT_FILE =
  "app/admin/(dashboard)/prijsmonitor/apex_scan_20260830_210808.json";
const CAPTURED_AT = "2026-08-30T21:08:08+02:00";
const SUSPECT_HIGH_PRICE_CENTS = 10_000;

const scan = apexScanRaw as unknown as Record<string, RawApexProduct[]>;

const sourceSummaries: PriceMonitorApexScanSource[] = [];
const rows: PriceMonitorApexScanItem[] = [];
let productCount = 0;

for (const [domain, rawProducts] of Object.entries(scan)) {
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  let sourcePriceRows = 0;
  productCount += products.length;

  products.forEach((product, productIndex) => {
    const rawVariants = Array.isArray(product.variants)
      ? (product.variants as RawApexVariant[])
      : [];
    const variants = rawVariants.length
      ? rawVariants
      : [{ title: "Standaard", price: product.price }];

    variants.forEach((variant, variantIndex) => {
      const priceCents = toCents(variant.price ?? product.price);
      const comparePriceCents = toCents(variant.compare_price);
      const packageLabel = optionalString(variant.unit);
      const sku = optionalString(variant.sku) ?? optionalString(product.sku);
      const qualityIssues: string[] = [];

      if (!packageLabel) qualityIssues.push("Gewicht ontbreekt");
      if (priceCents === null || priceCents <= 0) {
        qualityIssues.push("Prijs controleren");
      } else if (priceCents > SUSPECT_HIGH_PRICE_CENTS) {
        qualityIssues.push("Hoge prijs controleren");
      }
      if (!sku) qualityIssues.push("SKU ontbreekt");

      rows.push({
        id: `${SCAN_ID}:${domain}:${productIndex}:${variantIndex}`,
        domain,
        productName: optionalString(product.name) ?? "Naam ontbreekt",
        variantName: optionalString(variant.title) ?? "Standaard",
        productUrl: trustedProductUrl(product.url, domain),
        priceCents,
        comparePriceCents,
        sku,
        packageLabel,
        unitPriceCents: toCents(variant.unit_price),
        safeForComparison: Boolean(packageLabel && priceCents && priceCents > 0),
        qualityIssues,
      });
      sourcePriceRows += 1;
    });
  });

  sourceSummaries.push({
    domain,
    productCount: products.length,
    priceRowCount: sourcePriceRows,
  });
}

const summary: PriceMonitorApexScanSummary = {
  id: SCAN_ID,
  scraperFile: SCRAPER_FILE,
  resultFile: RESULT_FILE,
  capturedAt: CAPTURED_AT,
  listedSources: sourceSummaries.length,
  sourcesWithResults: sourceSummaries.filter((source) => source.productCount > 0)
    .length,
  productCount,
  priceRowCount: rows.length,
  rowsWithSku: rows.filter((row) => row.sku !== null).length,
  rowsWithPackage: rows.filter((row) => row.packageLabel !== null).length,
  readyForComparisonRows: rows.filter((row) => row.safeForComparison).length,
  invalidPriceRows: rows.filter(
    (row) => row.priceCents === null || row.priceCents <= 0
  ).length,
  suspectHighPriceRows: rows.filter(
    (row) => row.priceCents !== null && row.priceCents > SUSPECT_HIGH_PRICE_CENTS
  ).length,
  sources: sourceSummaries,
};

export function getApexScanSummary(): PriceMonitorApexScanSummary {
  return summary;
}

export function getApexScanPage({
  query = "",
  source = "",
  offset = 0,
  limit = 50,
}: {
  query?: string;
  source?: string;
  offset?: number;
  limit?: number;
} = {}): PriceMonitorApexScanPage {
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
  const normalizedSource = source.trim().toLocaleLowerCase("nl-NL");
  const safeOffset = Number.isInteger(offset) ? Math.max(0, offset) : 0;
  const safeLimit = Number.isInteger(limit)
    ? Math.min(100, Math.max(1, limit))
    : 50;

  const filtered = rows.filter((row) => {
    if (
      normalizedSource &&
      row.domain.toLocaleLowerCase("nl-NL") !== normalizedSource
    ) {
      return false;
    }
    if (!normalizedQuery) return true;
    return `${row.domain} ${row.productName} ${row.variantName} ${row.sku ?? ""}`
      .toLocaleLowerCase("nl-NL")
      .includes(normalizedQuery);
  });

  return {
    total: filtered.length,
    offset: safeOffset,
    limit: safeLimit,
    items: filtered.slice(safeOffset, safeOffset + safeLimit),
  };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function trustedProductUrl(value: unknown, domain: string): string | null {
  const rawUrl = optionalString(value);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    const normalizedDomain = domain.toLocaleLowerCase("en-US");
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (
      hostname !== normalizedDomain &&
      !hostname.endsWith(`.${normalizedDomain}`)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
