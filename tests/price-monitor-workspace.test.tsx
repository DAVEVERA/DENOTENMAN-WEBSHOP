import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceMonitorWorkspace } from "../components/admin-panel/price-monitor/PriceMonitorWorkspace";
import type { PriceMonitorDashboard } from "../lib/price-monitor/types";

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

test("non-technical onboarding and both connected scrapers render on first visit", () => {
  const html = renderToStaticMarkup(<PriceMonitorWorkspace initialDashboard={dashboard} canWrite />);
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
});
