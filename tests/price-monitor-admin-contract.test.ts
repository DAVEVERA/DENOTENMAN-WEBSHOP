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
const apexScanRoute = read("app/api/admin/price-monitor/apex-scan/route.ts");
const apexLocalAdminRoute = read("app/api/admin/price-monitor/apex-local/route.ts");
const apexLocalUploadRoute = read("app/api/price-monitor/apex-local/[runId]/route.ts");
const cronRoute = read("app/api/internal/price-monitor/reports/route.ts");
const page = read("app/admin/(dashboard)/prijsmonitor/page.tsx");
const workspace = read("components/admin-panel/price-monitor/PriceMonitorWorkspace.tsx");
const service = read("lib/price-monitor/service.ts");
const scraper = read("lib/price-monitor/scrapers/noten-nl.ts");
const basBoerScraper = read("lib/price-monitor/scrapers/bas-boer.ts");
const sources = read("lib/price-monitor/sources.ts");
const registry = read("lib/price-monitor/scrapers/registry.ts");
const basBoerReference = read("app/admin/(dashboard)/prijsmonitor/apexpredator_BB.py");
const apexReference = read("app/admin/(dashboard)/prijsmonitor/apex.py");
const apexLoader = read("lib/price-monitor/apex-scan.ts");
const apexLocal = read("lib/price-monitor/apex-local.ts");
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
  assert.match(apexScanRoute, /getAdminSession/);
  assert.match(apexScanRoute, /private, no-store/);
  assert.match(apexLocalAdminRoute, /getAdminSession/);
  assert.match(apexLocalAdminRoute, /hasProductWritePermission/);
  assert.match(apexLocalAdminRoute, /isSameOriginMutation/);
  assert.match(apexLocalAdminRoute, /private, no-store/);
  assert.match(apexLocalUploadRoute, /Authorization|authorization/);
  assert.match(apexLocalUploadRoute, /Bearer /);
  assert.match(apexLocalUploadRoute, /MAX_UPLOAD_BYTES = 2_000_000/);
  assert.match(apexLocalUploadRoute, /apexLocalUploadSchema\.safeParse/);
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

test("scrapers use separate adapters and cannot redirect outside approved hosts", () => {
  assert.match(sources, /key: "noten-nl"/);
  assert.match(sources, /key: "bas-boer"/);
  assert.match(sources, /adapterKey: "bas-boer-v1"/);
  assert.match(sources, /key: "bas-boer"[\s\S]*?status: "READY"[\s\S]*?canRun: true/);
  assert.match(registry, /\["noten-nl", notenNlAdapter\]/);
  assert.match(registry, /\["bas-boer", basBoerAdapter\]/);
  assert.match(scraper, /redirect: "manual"/);
  assert.match(scraper, /\(\^\|\\\.\)noten\\\.nl\$/);
  assert.match(scraper, /Math\.min\(50/);
  assert.match(scraper, /SCRAPE_CONCURRENCY = 3/);
  assert.match(scraper, /readBoundedText/);
  assert.match(scraper, /AbortSignal\.timeout/);
  assert.match(basBoerScraper, /redirect: "manual"/);
  assert.match(basBoerScraper, /ALLOWED_HOSTS/);
  assert.match(basBoerScraper, /Math\.min\(50/);
  assert.match(basBoerScraper, /SCRAPE_CONCURRENCY = 2/);
  assert.match(basBoerScraper, /readBoundedText/);
  assert.match(basBoerScraper, /AbortSignal\.timeout/);
  assert.match(basBoerScraper, /HTTP 429/);
  assert.match(basBoerReference, /MAX_PRODUCTS = 25/);
  assert.match(apexReference, /ULTIMATE SCRAPER v2/);
  assert.match(apexReference, /basboernoten\.nl/);
  assert.match(apexReference, /nootje\.eu/);
  assert.match(apexReference, /noototheek\.nl/);
  assert.match(apexReference, /MAX_PRODUCTS_PER_SITE/);
  assert.match(apexReference, /sorted\(product_urls\)\[:MAX_PRODUCTS_PER_SITE\]/);
  assert.match(apexReference, /import argparse/);
  assert.match(apexReference, /"--domain"/);
  assert.match(apexReference, /"--limit"/);
  assert.match(apexReference, /"--max-pages"/);
  assert.match(apexReference, /"--upload-url"/);
  assert.match(apexReference, /"--upload-token"/);
  assert.match(apexReference, /"Authorization": f"Bearer \{upload_token\}"/);
  assert.match(apexReference, /automatisch inladen is begrensd op maximaal 25 producten/);
  assert.match(apexReference, /extract_unit/);
  assert.match(apexReference, /calc_unit_price/);
  assert.match(apexReference, /selected_sites = \[args\.domain\] if args\.domain else/);
  assert.match(apexReference, /allow_redirects=False/);
  assert.match(apexReference, /size > 2_000_000/);
  assert.match(apexLoader, /apex_scan_20260830_210808\.json/);
  assert.match(apexLoader, /app\/admin\/\(dashboard\)\/prijsmonitor\/apex\.py/);
  assert.doesNotMatch(runRoute, /child_process|spawn\(|exec\(/);
  assert.doesNotMatch(apexScanRoute, /child_process|spawn\(|exec\(/);
  assert.match(runRoute, /after\(/);
  assert.match(runRoute, /status: 202/);
  assert.match(applyRoute, /frontendSynced/);
  assert.match(workspace, /Download apex\.py/);
  assert.match(workspace, /navigator\.clipboard\.writeText/);
  assert.match(workspace, /\/api\/admin\/price-monitor\/apex-local/);
  assert.match(workspace, /readLocalApexResult/);
  assert.match(workspace, /file\.text\(\)/);
  assert.match(workspace, /MAX_LOCAL_APEX_FILE_BYTES = 20_000_000/);
  assert.doesNotMatch(page, /apex-job|PRICE_MONITOR_APEX_JOB|isApexJobConfigured/);
  assert.doesNotMatch(workspace, /\/api\/admin\/price-monitor\/apex-runs|Cloud Run Job/);
  assert.match(apexLocal, /createHmac/);
  assert.match(apexLocal, /timingSafeEqual/);
  assert.match(apexLocal, /30 \* 60 \* 1000/);
  assert.match(apexLocal, /MAX_UPLOAD_PRODUCTS = 25/);
  assert.match(apexLocal, /isAllowedLocalApexDomain/);
  assert.match(apexLocal, /priceMonitorCompetitorProduct|completeLocalApexRun/);
  assert.match(apexLocal, /priceSource: "VISIBLE_FALLBACK"/);
  assert.match(apexLocal, /comparePriceCents !== null && comparePriceCents > priceCents/);
  assert.match(service, /sourceId_sourceUrl/);
  assert.match(service, /VERVANGEN_DOOR_NIEUWSTE_METING/);
  assert.match(service, /status: "PARTIAL"/);
  assert.doesNotMatch(apexLocalAdminRoute, /child_process|spawn\(|exec\(/);
  assert.doesNotMatch(apexLocalUploadRoute, /child_process|spawn\(|exec\(/);
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
