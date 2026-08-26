import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildDashboardForecast, buildDashboardIssues } from "../lib/admin-dashboard-analysis";
import { buildMollieRevenue } from "../lib/admin-dashboard-revenue";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  EMPTY_DASHBOARD_ANALYTICS,
  retainAnalyticsAfterRefreshFailure,
} from "../lib/admin-dashboard-contract";
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

test("Mollie revenue uses live paid payments, Amsterdam dates and net amounts", () => {
  const revenue = buildMollieRevenue([
    {
      mode: "live",
      status: "paid",
      paidAt: "2026-08-25T22:30:00.000Z",
      amount: { currency: "EUR", value: "20.00" },
      amountRefunded: { currency: "EUR", value: "3.00" },
      amountChargedBack: { currency: "EUR", value: "2.00" },
    },
    {
      mode: "live",
      status: "paid",
      paidAt: "2026-08-25T21:59:00.000Z",
      amount: { currency: "EUR", value: "8.50" },
    },
    {
      mode: "test",
      status: "paid",
      paidAt: "2026-08-25T22:45:00.000Z",
      amount: { currency: "EUR", value: "99.00" },
    },
    {
      mode: "live",
      status: "failed",
      paidAt: "2026-08-25T22:50:00.000Z",
      amount: { currency: "EUR", value: "45.00" },
    },
    {
      mode: "live",
      status: "paid",
      paidAt: "2026-08-25T22:55:00.000Z",
      amount: { currency: "USD", value: "12.00" },
    },
  ], new Date("2026-08-26T10:00:00.000Z"));

  assert.equal(revenue.revenueToday, 15);
  assert.equal(revenue.paidPayments, 2);
  assert.equal(revenue.unsupportedCurrencies, 1);
  assert.equal(revenue.daily.length, 90);
  assert.equal(revenue.daily.at(-1)?.date, "2026-08-26");
  assert.equal(revenue.daily.at(-1)?.partial, true);
  assert.equal(revenue.daily.find((point) => point.date === "2026-08-25")?.revenue, 8.5);
});

test("combined dashboard keeps GA4 traffic and Mollie revenue at the same time", async () => {
  const analysis = await import("../lib/admin-dashboard-analysis");
  const combine = (analysis as unknown as {
    combineDashboardSources?: (
      ga4: typeof EMPTY_DASHBOARD_ANALYTICS,
      mollie: {
        status: "live";
        generatedAt: string;
        message: string;
        revenueToday: number;
        daily: typeof EMPTY_DASHBOARD_ANALYTICS.revenueDaily;
      }
    ) => typeof EMPTY_DASHBOARD_ANALYTICS;
  }).combineDashboardSources;
  assert.equal(typeof combine, "function");

  const ga4 = {
    ...EMPTY_DASHBOARD_ANALYTICS,
    status: "live" as const,
    generatedAt: "2026-08-26T08:00:00.000Z",
    message: "Live GA4-verkeersgegevens",
    metrics: {
      ...EMPTY_DASHBOARD_ANALYTICS.metrics,
      sessions: 17,
      activeVisitors: 3,
    },
  };
  const revenueDaily = [{
    date: "2026-08-26",
    sessions: 0,
    revenue: 42.45,
    partial: true,
  }];
  const combined = combine!(ga4, {
    status: "live",
    generatedAt: "2026-08-26T08:01:00.000Z",
    message: "Live Mollie-omzet",
    revenueToday: 42.45,
    daily: revenueDaily,
  });

  assert.equal(combined.status, "live");
  assert.equal(combined.metrics.sessions, 17);
  assert.equal(combined.metrics.activeVisitors, 3);
  assert.equal(combined.metrics.revenueToday, 42.45);
  assert.deepEqual(combined.revenueDaily, revenueDaily);
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
  assert.match(provider, /GA4_SNAPSHOT_SETTING_KEY/);
  assert.match(provider, /getSetting\(GA4_SNAPSHOT_SETTING_KEY\)/);
  assert.match(provider, /setSetting\([\s\S]*GA4_SNAPSHOT_SETTING_KEY/);
  assert.match(provider, /getInitialAdminDashboardAnalytics/);
  assert.match(provider, /requestWithRetry/);
  assert.match(provider, /status === 429/);
  assert.match(provider, /getMollieClient/);
  assert.match(provider, /MOLLIE_REVENUE_SNAPSHOT_SETTING_KEY/);
  assert.doesNotMatch(provider, /revenueToday:[\s\S]{0,100}purchaseRevenue/);
  assert.doesNotMatch(provider, /GA4_PROPERTY_ID\?\.trim\(\) \|\|/);
});

test("admin dashboard renders a persisted GA4 snapshot before the client refresh", () => {
  const page = readFileSync("app/admin/(dashboard)/page.tsx", "utf8");
  const workspace = readFileSync("components/admin-panel/AdminDashboardWorkspace.tsx", "utf8");

  assert.match(page, /getInitialAdminDashboardAnalytics\(\)/);
  assert.match(page, /initialAnalytics=\{initialAnalytics\}/);
  assert.match(workspace, /initialAnalytics: DashboardAnalytics/);
  assert.match(workspace, /useState<DashboardAnalytics>\(initialAnalytics\)/);
  assert.match(workspace, /retainAnalyticsAfterRefreshFailure/);
  assert.doesNotMatch(workspace, /catch \{[\s\S]{0,180}EMPTY_DASHBOARD_ANALYTICS/);
});

test("a failed client refresh keeps the last valid GA4 values and timestamp", () => {
  const live = {
    ...EMPTY_DASHBOARD_ANALYTICS,
    status: "live" as const,
    generatedAt: "2026-08-24T12:07:00.000Z",
    message: "Live GA4-gegevens",
    metrics: { ...EMPTY_DASHBOARD_ANALYTICS.metrics, sessions: 8, views: 24 },
  };

  const retained = retainAnalyticsAfterRefreshFailure(live);
  assert.equal(retained.status, "partial");
  assert.equal(retained.generatedAt, live.generatedAt);
  assert.equal(retained.metrics.sessions, 8);
  assert.equal(retained.metrics.views, 24);
  assert.match(retained.message, /blijven zichtbaar/);
  assert.equal(retainAnalyticsAfterRefreshFailure(EMPTY_DASHBOARD_ANALYTICS), EMPTY_DASHBOARD_ANALYTICS);
});

test("GA4 property configuration survives both Cloud Run deployment paths", () => {
  for (const path of ["cloudbuild.yaml", "cloudbuild-trigger.yaml"]) {
    const build = readFileSync(path, "utf8");
    assert.match(build, /--update-env-vars=GA4_PROPERTY_ID=\$\{_GA4_PROPERTY_ID\}/);
    assert.match(build, /_GA4_PROPERTY_ID:\s*"549991816"/);
  }
});

test("customer service uses the supplied WhatsApp Business number", () => {
  assert.equal(CUSTOMER_SERVICE_WHATSAPP_URL, "https://wa.me/31411700232");
});
