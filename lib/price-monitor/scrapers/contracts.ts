import type { PriceMonitorSourceDefinition } from "@/lib/price-monitor/sources";
import type { ScrapedCompetitorProduct } from "@/lib/price-monitor/types";

export type ScraperProgress = {
  phase: "DISCOVERING" | "SCRAPING";
  current: number;
  total: number | null;
  message: string;
};

export type ScraperRunOptions = {
  limit: number;
  onProgress?: (progress: ScraperProgress) => void | Promise<void>;
};

export interface PriceMonitorScraperAdapter {
  source: PriceMonitorSourceDefinition;
  discoverProductUrls(limit: number): Promise<string[]>;
  scrapeProduct(url: string): Promise<ScrapedCompetitorProduct[]>;
  run(options: ScraperRunOptions): Promise<{
    discoveredCount: number;
    products: ScrapedCompetitorProduct[];
    errors: Array<{ url: string; message: string }>;
  }>;
}
