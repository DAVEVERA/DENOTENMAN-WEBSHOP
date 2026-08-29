import "server-only";

import type { PriceMonitorScraperAdapter } from "@/lib/price-monitor/scrapers/contracts";
import { basBoerAdapter } from "@/lib/price-monitor/scrapers/bas-boer";
import { notenNlAdapter } from "@/lib/price-monitor/scrapers/noten-nl";

const adapters = new Map<string, PriceMonitorScraperAdapter>([
  ["noten-nl", notenNlAdapter],
  ["bas-boer", basBoerAdapter],
]);

export function getPriceMonitorAdapter(sourceKey: string): PriceMonitorScraperAdapter | null {
  return adapters.get(sourceKey) || null;
}
