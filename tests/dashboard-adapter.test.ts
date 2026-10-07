import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_DASHBOARD_ANALYTICS, type DashboardAnalytics } from "../lib/admin-dashboard-contract";
import { buildWidgetView, originLabel, periodLabel, widgetDeepLink, type WidgetContext } from "../lib/dashboard/adapter";
import { BUILTIN_WIDGETS, materializeBuiltin } from "../lib/dashboard/defaults";
import type { DashboardWidgetConfig } from "../lib/dashboard/schema";

const widgetById = (id: string): DashboardWidgetConfig => {
  const builtin = BUILTIN_WIDGETS.find((item) => item.id === id);
  assert.ok(builtin, `built-in ${id} exists`);
  return materializeBuiltin(builtin);
};

const analytics: DashboardAnalytics = {
  ...EMPTY_DASHBOARD_ANALYTICS,
  status: "live",
  message: "",
  metrics: { activeVisitors: 7, revenueToday: 312.5, sessions: 480, views: 1320, engagement: 0.62, keyEvents: 12 },
  daily: [
    { date: "2026-10-04", sessions: 400, revenue: 0 },
    { date: "2026-10-05", sessions: 500, revenue: 0 },
    { date: "2026-10-06", sessions: 480, revenue: 0, partial: true },
  ],
  revenueDaily: [
    { date: "2026-10-04", sessions: 0, revenue: 200 },
    { date: "2026-10-05", sessions: 0, revenue: 250 },
    { date: "2026-10-06", sessions: 0, revenue: 312.5, partial: true },
  ],
  forecast: {
    confidence: "middel",
    trainingDays: 14,
    reason: "",
    points: [
      { date: "2026-10-07", expected: 500, low: 400, high: 600 },
      { date: "2026-10-08", expected: 520, low: 410, high: 630 },
    ],
  },
  funnel: { cart: 300, checkout: 120, purchase: 40 },
  signals: { critical: 2, high: 3, positive: 1 },
  issues: [{ id: "i1", severity: "critical", title: "Iets", evidence: "Bewijs", action: "Doen" }],
};

const context: WidgetContext = {
  analytics,
  commerce: { activeProducts: 142, categories: 18, totalOrders: 905, pendingOrders: 6 },
  recentOrdersCount: 8,
};

test("a number widget reads the measure its own configuration names", () => {
  const cases: Array<[string, number | null]> = [
    ["active-visitors", 7],
    ["revenue-today", 312.5],
    ["sessions", 480],
    ["views", 1320],
    ["engagement", 0.62],
    ["key-events", 12],
    ["active-products", 142],
    ["categories", 18],
    ["total-orders", 905],
    ["pending-orders", 6],
  ];
  for (const [id, expected] of cases) {
    const view = buildWidgetView(widgetById(id), context);
    assert.equal(view.kind, "kpi", id);
    assert.equal(view.kind === "kpi" ? view.value : undefined, expected, id);
  }
});

test("the two widgets that matter most are the big ones", () => {
  for (const id of ["active-visitors", "revenue-today"]) {
    const view = buildWidgetView(widgetById(id), context);
    assert.equal(view.kind === "kpi" && view.hero, true, id);
  }
  const view = buildWidgetView(widgetById("sessions"), context);
  assert.equal(view.kind === "kpi" && view.hero, false);
});

test("a comparison only appears when there are two finished periods to compare", () => {
  // A running period is never compared: an hour into the day every number looks like a drop.
  const running = buildWidgetView(widgetById("revenue-today"), context);
  assert.equal(running.kind === "kpi" ? running.change : "missing", null);

  const view = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "yesterday" } }, context);
  assert.equal(view.kind, "kpi");
  // 04-10 and 05-10 are finished; today is still running and is left out.
  assert.equal(view.kind === "kpi" ? view.change?.label : undefined, "+25% tegenover vorige periode");

  const thin = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "yesterday" } }, {
    ...context,
    analytics: { ...analytics, revenueDaily: [{ date: "2026-10-06", sessions: 0, revenue: 10, partial: true }] },
  });
  assert.equal(thin.kind === "kpi" ? thin.change : "missing", null, "one running day is not a comparison");

  const noComparison = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "yesterday" }, comparison: "none" }, context);
  assert.equal(noComparison.kind === "kpi" ? noComparison.change : "missing", null);
});

test("a widget links to the filtered list it summarises", () => {
  assert.equal(widgetDeepLink(widgetById("pending-orders")), "/admin/bestellingen?status=PENDING");
  assert.equal(widgetDeepLink(widgetById("total-orders")), "/admin/bestellingen");
  assert.equal(widgetDeepLink(widgetById("categories")), "/admin/categorieen");
  assert.equal(widgetDeepLink(widgetById("active-products")), "/admin/producten");
  assert.equal(widgetDeepLink(widgetById("revenue-today")), "/admin/facturen");
});

test("a chart widget turns the stored history into a drawable series", () => {
  const revenue = buildWidgetView(widgetById("daily-revenue"), context);
  assert.equal(revenue.kind, "timeSeries");
  if (revenue.kind !== "timeSeries") return;
  assert.deepEqual(revenue.data.categories, ["04-10", "05-10", "06-10"]);
  assert.equal(revenue.data.series[0].points.at(-1)?.partial, true, "today is marked as still running");
  assert.equal(revenue.variant, "line");
  assert.equal(revenue.periodLabel, "afgelopen 30 dagen");

  const forecast = buildWidgetView(widgetById("forecast"), context);
  assert.equal(forecast.kind, "timeSeries");
  assert.equal(forecast.kind === "timeSeries" ? forecast.data.series.length : 0, 3, "expected plus the band");
});

test("the funnel says it counts events as long as it cannot count visitors", () => {
  const view = buildWidgetView(widgetById("funnel"), context);
  assert.equal(view.kind, "funnel");
  assert.equal(view.kind === "funnel" ? view.comparable : true, false);
  assert.deepEqual(view.kind === "funnel" ? view.steps.map((step) => step.value) : [], [300, 120, 40]);
});

test("the two analysis widgets stay two different things", () => {
  assert.equal(buildWidgetView(widgetById("improvement-signals"), context).kind, "signals");
  assert.equal(buildWidgetView(widgetById("improvements"), context).kind, "issues");
});

test("a source with nothing measured says so instead of showing zero", () => {
  const down: WidgetContext = { ...context, analytics: EMPTY_DASHBOARD_ANALYTICS };
  const sessions = buildWidgetView(widgetById("sessions"), down);
  assert.equal(sessions.kind, "unavailable");
  assert.equal(sessions.kind === "unavailable" ? sessions.state : "", "not_measured");
  assert.match(sessions.kind === "unavailable" ? sessions.message ?? "" : "", /niet beschikbaar/u);

  // The shop's own numbers do not depend on GA4 and stay readable.
  const products = buildWidgetView(widgetById("active-products"), down);
  assert.equal(products.kind, "kpi");
  assert.equal(products.kind === "kpi" ? products.value : null, 142);
});

test("empty lists and a removed source each give their own honest state", () => {
  const noOrders = buildWidgetView(widgetById("recent-orders"), { ...context, recentOrdersCount: 0 });
  assert.equal(noOrders.kind === "unavailable" ? noOrders.state : "", "empty");

  const noIssues = buildWidgetView(widgetById("improvements"), { ...context, analytics: { ...analytics, issues: [] } });
  assert.equal(noIssues.kind === "unavailable" ? noIssues.state : "", "empty");

  const gone = buildWidgetView({ ...widgetById("sessions"), source: "verwijderd" }, context);
  assert.equal(gone.kind === "unavailable" ? gone.state : "", "error");

  const emptyFunnel = buildWidgetView(widgetById("funnel"), { ...context, analytics: { ...analytics, funnel: { cart: null, checkout: null, purchase: null } } });
  assert.equal(emptyFunnel.kind === "unavailable" ? emptyFunnel.state : "", "not_measured");
});

test("every widget names its period and where the numbers come from", () => {
  assert.equal(periodLabel(widgetById("daily-revenue")), "afgelopen 30 dagen");
  assert.equal(periodLabel(widgetById("active-visitors")), "vandaag");
  assert.equal(periodLabel({ ...widgetById("daily-revenue"), dateRange: { preset: "custom", from: "2026-10-01", to: "2026-10-07" } }), "2026-10-01 tot en met 2026-10-07");
  assert.equal(originLabel(widgetById("daily-revenue")), "Mollie");
  assert.equal(originLabel(widgetById("sessions")), "GA4");
  assert.equal(originLabel(widgetById("total-orders")), "Webshopdatabase");
});

test("every shipped widget renders as something, never as a blank card", () => {
  for (const builtin of BUILTIN_WIDGETS) {
    const view = buildWidgetView(materializeBuiltin(builtin), context);
    assert.notEqual(view.kind, "unavailable", `${builtin.id} has data in this context`);
  }
});

test("a number over a longer period is a real total, not today's figure", () => {
  const history = Array.from({ length: 60 }, (_, index) => ({
    date: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
    sessions: 0,
    revenue: 10,
  }));
  const long: WidgetContext = { ...context, analytics: { ...analytics, metrics: { ...analytics.metrics, revenueToday: 10 }, revenueDaily: history } };

  const today = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "today" } }, long);
  assert.equal(today.kind === "kpi" ? today.value : null, 10, "a today widget shows today");

  const week = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "last_7_days" } }, long);
  assert.equal(week.kind === "kpi" ? week.value : null, 70, "seven days of ten euro is seventy");

  const month = buildWidgetView({ ...widgetById("revenue-today"), dateRange: { preset: "last_30_days" } }, long);
  assert.equal(month.kind === "kpi" ? month.value : null, 300);
});

test("a comparison measures the same number of days on both sides, or stays silent", () => {
  const day = (revenue: number, index: number) => ({ date: `2026-09-${String(index + 1).padStart(2, "0")}`, sessions: 0, revenue });
  // Fourteen whole days: the last seven total 140, the seven before them total 70.
  const history = [...Array.from({ length: 7 }, (_, i) => day(10, i)), ...Array.from({ length: 7 }, (_, i) => day(20, i + 7))];
  const view = buildWidgetView(
    { ...widgetById("revenue-today"), dateRange: { preset: "last_7_days" }, comparison: "previous_period" },
    { ...context, analytics: { ...analytics, revenueDaily: history } },
  );
  assert.equal(view.kind === "kpi" ? view.value : null, 140);
  assert.equal(view.kind === "kpi" ? view.change?.label : null, "+100% tegenover vorige periode");

  // Only ten whole days: there is no second window of seven, so no comparison is claimed.
  const short = buildWidgetView(
    { ...widgetById("revenue-today"), dateRange: { preset: "last_7_days" }, comparison: "previous_period" },
    { ...context, analytics: { ...analytics, revenueDaily: history.slice(0, 10) } },
  );
  assert.equal(short.kind === "kpi" ? short.change : "missing", null);
});

test("the trend line follows the grouping, the comparison does not", () => {
  const finished = { preset: "yesterday" as const };
  const bare = buildWidgetView({ ...widgetById("revenue-today"), dateRange: finished, dimensions: [] }, context);
  assert.equal(bare.kind === "kpi" ? bare.trend : "missing", undefined, "no grouping, no trend line");
  assert.ok(bare.kind === "kpi" && bare.change, "but the comparison is still there");

  const grouped = buildWidgetView({ ...widgetById("revenue-today"), dateRange: finished, dimensions: ["date"] }, context);
  assert.ok(grouped.kind === "kpi" && grouped.trend, "grouped by day draws the trend");
});
