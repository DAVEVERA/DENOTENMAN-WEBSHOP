import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const runRoute = read("app/api/admin/price-monitor/runs/route.ts");
const matchRoute = read("app/api/admin/price-monitor/matches/[id]/route.ts");
const applyRoute = read("app/api/admin/price-monitor/recommendations/[id]/apply/route.ts");
const scheduleRoute = read("app/api/admin/price-monitor/reports/schedule/route.ts");
const exportRoute = read("app/api/admin/price-monitor/reports/export/route.ts");
const cronRoute = read("app/api/internal/price-monitor/reports/route.ts");
const page = read("app/admin/(dashboard)/prijsmonitor/page.tsx");
const service = read("lib/price-monitor/service.ts");
const scraper = read("lib/price-monitor/scrapers/noten-nl.ts");
const sources = read("lib/price-monitor/sources.ts");
const registry = read("lib/price-monitor/scrapers/registry.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260829153000_add_price_monitor/migration.sql");

test("price monitor page and APIs stay behind the admin boundary", () => {
  assert.match(page, /verifyAdminSessionToken/);
  assert.match(page, /adminUser\.findUnique/);
  for (const route of [runRoute, matchRoute, applyRoute, scheduleRoute]) {
    assert.match(route, /getAdminSession/);
    assert.match(route, /hasProductWritePermission/);
    assert.match(route, /isSameOriginMutation/);
  }
  assert.match(exportRoute, /getAdminSession/);
  assert.match(exportRoute, /private, no-store/);
  assert.match(cronRoute, /PRICE_MONITOR_CRON_SECRET/);
  assert.match(cronRoute, /crypto\.subtle\.digest/);
});

test("automatic price actions fail closed on stale, unsafe or promotional data", () => {
  assert.match(service, /RECOMMENDATION_NOT_ACTIONABLE/);
  assert.match(service, /STALE_OBSERVATION/);
  assert.match(service, /UNSAFE_SOURCE_DATA/);
  assert.match(service, /COMPETITOR_PROMOTION/);
  assert.match(service, /UNVERIFIED_PRICE_SOURCE/);
  assert.match(service, /RECOMMENDATION_STALE_BASELINE/);
  assert.match(service, /VERVALLEN_NA_PRIJSWIJZIGING/);
  assert.match(service, /ACTIVE_SALE_PRICE/);
  assert.match(service, /validatePriceAction/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /PriceMonitorPriceAction/);
  assert.match(service, /recommendationByEvidence/);
  assert.doesNotMatch(service, /take: 150/);
});

test("scrapers use separate adapters and Noten.nl cannot redirect outside its host", () => {
  assert.match(sources, /key: "noten-nl"/);
  assert.match(sources, /key: "bas-boer"/);
  assert.match(sources, /adapterKey: "bas-boer-pending"/);
  assert.match(registry, /\[\["noten-nl", notenNlAdapter\]\]/);
  assert.match(scraper, /redirect: "manual"/);
  assert.match(scraper, /\(\^\|\\\.\)noten\\\.nl\$/);
  assert.match(scraper, /Math\.min\(50/);
  assert.match(scraper, /SCRAPE_CONCURRENCY = 3/);
  assert.match(scraper, /readBoundedText/);
  assert.match(scraper, /AbortSignal\.timeout/);
  assert.match(runRoute, /after\(/);
  assert.match(runRoute, /status: 202/);
  assert.match(applyRoute, /frontendSynced/);
});

test("the additive schema and migration contain the full monitor boundary", () => {
  for (const model of [
    "PriceMonitorSource",
    "PriceMonitorCrawlRun",
    "PriceMonitorCompetitorProduct",
    "PriceMonitorObservation",
    "PriceMonitorMatch",
    "PricingRecommendation",
    "PriceMonitorReportSchedule",
  ]) {
    assert.match(schema, new RegExp(`model ${model}\\b`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
});
