import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceMonitorWorkspace } from "../components/admin-panel/price-monitor/PriceMonitorWorkspace";
import type { PriceMonitorDashboard } from "../lib/price-monitor/types";
import type { PriceMonitorApexScanSummary } from "../lib/price-monitor/types";

const source = readFileSync(
  join(process.cwd(), "components/admin-panel/price-monitor/PriceMonitorWorkspace.tsx"),
  "utf8"
);

const dashboard: PriceMonitorDashboard = {
  generatedAt: "2026-08-29T12:00:00.000Z",
  setupRequired: false,
  summary: {
    connectedSources: 1,
    totalSources: 2,
    productsObserved: 0,
    approvedMatches: 0,
    matchesToReview: 0,
    significantDifferences: 0,
    openActions: 0,
    averageDataQualityScore: null,
    opportunityPer100Cents: 0,
  },
  sources: [
    {
      key: "noten-nl",
      name: "Noten.nl",
      baseUrl: "https://www.noten.nl",
      status: "READY",
      statusLabel: "Klaar voor proefrun",
      statusNote: "Start eerst met maximaal 25 producten.",
      canRun: true,
      lastRunAt: null,
      lastRunStatus: null,
      productsSeen: 0,
    },
    {
      key: "bas-boer",
      name: "Bas Boer Noten",
      baseUrl: "https://www.basboernoten.nl",
      status: "READY",
      statusLabel: "Klaar voor proefrun",
      statusNote: "De begrensde Bas Boer-koppeling staat klaar.",
      canRun: true,
      lastRunAt: null,
      lastRunStatus: null,
      productsSeen: 0,
    },
  ],
  comparisons: [],
  schedule: {
    id: null,
    enabled: false,
    frequency: "WEEKLY",
    hourLocal: 7,
    recipientEmail: "",
    formats: ["CSV"],
    minDifferencePercent: 10,
    nextRunAt: null,
    lastSentAt: null,
    lastStatus: "NEVER",
    lastError: null,
  },
};

const apexScan: PriceMonitorApexScanSummary = {
  id: "apex-20260830-210808",
  scraperFile: "app/admin/(dashboard)/prijsmonitor/apex.py",
  resultFile: "app/admin/(dashboard)/prijsmonitor/apex_scan_20260830_210808.json",
  capturedAt: "2026-08-30T21:08:08+02:00",
  listedSources: 19,
  sourcesWithResults: 9,
  productCount: 900,
  priceRowCount: 1419,
  rowsWithSku: 922,
  rowsWithPackage: 0,
  readyForComparisonRows: 0,
  invalidPriceRows: 3,
  suspectHighPriceRows: 75,
  sources: [
    { domain: "noototheek.nl", productCount: 405, priceRowCount: 924 },
    { domain: "basboernoten.nl", productCount: 15, priceRowCount: 15 },
  ],
};

test("non-technical onboarding and both connected scrapers render on first visit", () => {
  const html = renderToStaticMarkup(<PriceMonitorWorkspace initialDashboard={dashboard} initialApexScan={apexScan} canWrite />);
  assert.match(html, /Prijsmonitor/);
  assert.match(html, /Zo werkt de prijsmonitor/);
  for (const step of [
    "Kies de winkels",
    "Start de prijsronde",
    "Wij maken prijzen vergelijkbaar",
    "Controleer wat niet duidelijk is",
    "Bekijk opvallende verschillen",
    "Bekijk het prijsvoorstel",
    "Pas aan en bevestig",
    "Download of ontvang een rapport",
  ]) assert.match(html, new RegExp(step));
  assert.match(html, /Noten\.nl/);
  assert.match(html, /Bas Boer Noten/);
  assert.match(html, /De begrensde Bas Boer-koppeling staat klaar/);
  assert.match(html, /Eerste APEX-scan ingelezen/);
  assert.match(html, /900 producten en 1\.419 prijsregels/);
  assert.match(html, /Er is geen live prijs aangepast/);
  assert.doesNotMatch(html, /Script nog koppelen/);
});

test("workspace keeps mobile cards, desktop tables, large controls and export choices", () => {
  assert.match(source, /grid-cols-2/);
  assert.match(source, /lg:hidden/);
  assert.match(source, /lg:block/);
  assert.match(source, /min-h-12/);
  assert.match(source, /text-base/);
  assert.match(source, /Excel \/ CSV/);
  assert.match(source, /Technische JSON/);
  assert.match(source, /Print \/ PDF/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /previousFocus\?\.focus/);
  assert.match(source, /const openSources/);
  assert.match(source, /setTab\("overview"\)/);
  assert.match(source, /Scraperresultaat/);
  assert.match(source, /\/api\/admin\/price-monitor\/apex-scan/);
  assert.match(source, /Nog niet gebruiken voor een prijsactie/);
  assert.match(source, /een volgende automatische APEX-run is nog niet aan de adminactie gekoppeld/);
});
