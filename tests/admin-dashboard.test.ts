import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildDashboardForecast, buildDashboardIssues } from "../lib/admin-dashboard-analysis";
import { DEFAULT_DASHBOARD_PREFERENCES } from "../lib/admin-dashboard-contract";
import { CUSTOMER_SERVICE_WHATSAPP_URL } from "../lib/customer-service";

test("default dashboard order matches the requested operational hierarchy", () => {
  const sources = DEFAULT_DASHBOARD_PREFERENCES.widgets.map((widget) => widget.source);
  assert.deepEqual(sources.slice(0, 2), ["activeVisitors", "revenueToday"]);
  assert.deepEqual(sources.slice(2, 6), ["sessions", "views", "engagement", "keyEvents"]);
  assert.ok(sources.indexOf("forecast") === sources.indexOf("recentOrders") + 1);
  assert.ok(sources.indexOf("funnel") === sources.indexOf("dailyRevenue") + 1);
  assert.ok(sources.indexOf("improvementSignals") > sources.indexOf("funnel"));
});

test("forecast excludes the partial day and creates seven bounded points", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    sessions: 10 + index,
    revenue: 0,
    partial: index === 11,
  }));
  const forecast = buildDashboardForecast(rows);
  assert.equal(forecast.trainingDays, 11);
  assert.equal(forecast.points.length, 7);
  assert.ok(forecast.points.every((point) => point.low >= 0 && point.high >= point.expected));
  assert.equal(forecast.points[0].date, "2026-08-12");
});

test("forecast variability uses a normalized deviation instead of an inflated sum", () => {
  const forecast = buildDashboardForecast([0, 2, 4, 6].map((sessions, index) => ({
    date: `2026-07-0${index + 1}`,
    sessions,
    revenue: 0,
  })));
  assert.ok(forecast.points[0].low >= 1);
  assert.ok(forecast.points[0].high <= 8);
});

test("measurement analysis classifies critical, high and positive signals and keeps event counts", () => {
  const result = buildDashboardIssues({
    summary: {
      sessions: 100,
      screenPageViews: 100,
      engagementRate: 0.72,
      transactions: 0,
      purchaseRevenue: 0,
    },
    pages: [{ pageTitle: "(not set)", screenPageViews: 25 }],
    sources: [{ sessionSourceMedium: "mollie.com / referral", sessions: 3 }],
    channels: [{ sessionDefaultChannelGroup: "Direct", sessions: 70 }],
    events: [
      { eventName: "add_to_cart", eventCount: 20 },
      { eventName: "begin_checkout", eventCount: 10 },
      { eventName: "purchase", eventCount: 2 },
    ],
    coverageDays: 12,
  });
  assert.deepEqual(result.funnel, { cart: 20, checkout: 10, purchase: 2 });
  assert.ok(result.issues.some((issue) => issue.severity === "critical"));
  assert.ok(result.issues.some((issue) => issue.severity === "high"));
  assert.ok(result.issues.some((issue) => issue.severity === "positive"));
});

test("dashboard is request-time and admin API routes authenticate before returning data", () => {
  const page = readFileSync("app/admin/(dashboard)/page.tsx", "utf8");
  const analyticsRoute = readFileSync("app/api/admin/dashboard/analytics/route.ts", "utf8");
  const preferencesRoute = readFileSync("app/api/admin/dashboard/preferences/route.ts", "utf8");
  assert.match(page, /await connection\(\)/);
  assert.match(page, /verifyAdminSessionToken/);
  assert.match(analyticsRoute, /getAdminSession/);
  assert.match(preferencesRoute, /getAdminSession/);
  assert.match(preferencesRoute, /admin\.dashboard\.preferences\./);
  const provider = readFileSync("lib/admin-dashboard-analytics.ts", "utf8");
  assert.match(provider, /const analysisSummary/);
  assert.match(provider, /summary: analysisSummary/);
  assert.match(provider, /"89daysAgo", "yesterday"/);
  assert.doesNotMatch(provider, /GA4_PROPERTY_ID\?\.trim\(\) \|\|/);
});

test("customer service uses the supplied WhatsApp Business number", () => {
  assert.equal(CUSTOMER_SERVICE_WHATSAPP_URL, "https://wa.me/31411700232");
});
