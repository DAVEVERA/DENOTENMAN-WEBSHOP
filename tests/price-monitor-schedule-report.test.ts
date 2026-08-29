import assert from "node:assert/strict";
import test from "node:test";
import { nextPriceReportRun } from "../lib/price-monitor/schedule";
import { priceMonitorCsv } from "../lib/price-monitor/report";
import type { PriceMonitorDashboard } from "../lib/price-monitor/types";

test("computes future daily, weekly and monthly report moments", () => {
  const now = new Date("2026-08-29T10:30:00.000Z");
  assert.equal(
    nextPriceReportRun(now, { frequency: "DAILY", hourLocal: 7 }).toISOString(),
    "2026-08-30T05:00:00.000Z"
  );
  assert.equal(
    nextPriceReportRun(now, { frequency: "WEEKLY", hourLocal: 7, dayOfWeek: 1 }).toISOString(),
    "2026-08-31T05:00:00.000Z"
  );
  assert.equal(
    nextPriceReportRun(now, { frequency: "MONTHLY", hourLocal: 7, dayOfMonth: 5 }).toISOString(),
    "2026-09-05T05:00:00.000Z"
  );
});

test("exports an Excel-friendly semicolon CSV with source evidence", () => {
  const dashboard = {
    generatedAt: "2026-08-29T10:00:00.000Z",
    setupRequired: false,
    summary: {
      connectedSources: 1,
      totalSources: 2,
      productsObserved: 1,
      approvedMatches: 1,
      matchesToReview: 0,
      significantDifferences: 1,
      openActions: 1,
      averageDataQualityScore: 95,
      opportunityPer100Cents: 5000,
    },
    sources: [],
    comparisons: [{
      matchId: "m1",
      recommendationId: "r1",
      variantId: "v1",
      ownProduct: "Amandelen",
      ownVariant: "500 gram",
      ownSku: "AMAN-500",
      competitor: "Noten.nl",
      competitorProduct: "Amandelen ongebrand 500 gram",
      competitorUrl: "https://www.noten.nl/noten/amandelen",
      ownPriceCents: 900,
      competitorEquivalentPriceCents: 800,
      ownNormalizedPriceCents: 1800,
      competitorNormalizedPriceCents: 1600,
      differenceBps: 1250,
      matchStatus: "APPROVED",
      matchConfidenceScore: 95,
      dataQualityScore: 95,
      qualityFlags: [],
      safeForAnalysis: true,
      observedAt: "2026-08-29T09:00:00.000Z",
      recommendationType: "LOWER",
      suggestedPriceCents: 850,
      scenarioImpactPer100Cents: -5000,
      rationale: "Voorzichtige stap",
      recommendationStatus: "OPEN",
    }],
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
  } satisfies PriceMonitorDashboard;
  const csv = priceMonitorCsv(dashboard);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Noten.nl"/);
  assert.match(csv, /"https:\/\/www\.noten\.nl\/noten\/amandelen"/);
  assert.match(csv, /"12.50"/);
});

test("CSV export neutralizes spreadsheet formulas from scraped text", () => {
  const dashboard = {
    generatedAt: "2026-08-29T10:00:00.000Z",
    setupRequired: false,
    summary: {
      connectedSources: 1,
      totalSources: 1,
      productsObserved: 1,
      approvedMatches: 0,
      matchesToReview: 1,
      significantDifferences: 0,
      openActions: 0,
      averageDataQualityScore: 80,
      opportunityPer100Cents: 0,
    },
    sources: [],
    comparisons: [{
      matchId: "m2",
      recommendationId: null,
      variantId: "v2",
      ownProduct: "Cashews",
      ownVariant: "500 gram",
      ownSku: "CAS-500",
      competitor: "Noten.nl",
      competitorProduct: '=HYPERLINK("https://example.invalid")',
      competitorUrl: "https://www.noten.nl/noten/cashews",
      ownPriceCents: 900,
      competitorEquivalentPriceCents: 900,
      ownNormalizedPriceCents: 1800,
      competitorNormalizedPriceCents: 1800,
      differenceBps: 0,
      matchStatus: "SUGGESTED",
      matchConfidenceScore: 75,
      dataQualityScore: 80,
      qualityFlags: [],
      safeForAnalysis: false,
      observedAt: "2026-08-29T09:00:00.000Z",
      recommendationType: null,
      suggestedPriceCents: null,
      scenarioImpactPer100Cents: null,
      rationale: null,
      recommendationStatus: null,
    }],
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
  } satisfies PriceMonitorDashboard;
  assert.match(priceMonitorCsv(dashboard), /"'=HYPERLINK/);
});
