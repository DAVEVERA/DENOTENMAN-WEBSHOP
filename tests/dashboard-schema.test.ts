import assert from "node:assert/strict";
import test from "node:test";

import { defaultDashboardPreferences } from "../lib/dashboard/defaults";
import { hideExactDuplicates, migratePreferences } from "../lib/dashboard/migrate";
import {
  DASHBOARD_GRID_COLUMNS,
  findDuplicateWidgets,
  layoutOrder,
  moveWidget,
  packLayout,
  resizeWidget,
  widgetFingerprint,
  type DashboardWidgetConfig,
} from "../lib/dashboard/schema";
import { compatibleVisualizations, defaultVisualization, groupLongTail, getVisualization, visualizationProblem } from "../lib/dashboard/visualizations";
import { validatePreferences, validateWidget } from "../lib/dashboard/validate";

const widget = (overrides: Partial<DashboardWidgetConfig> = {}): DashboardWidgetConfig => ({
  schemaVersion: 2,
  id: "w1",
  ownerId: null,
  scope: "personal",
  source: "ga4_traffic",
  metrics: [{ field: "sessions", aggregation: "sum" }],
  dimensions: [],
  filters: [],
  dateRange: { preset: "today" },
  comparison: "none",
  visualization: "kpi",
  display: { title: "Sessies", format: "integer" },
  layout: { x: 0, y: 0, w: 3, h: 1 },
  hidden: false,
  custom: false,
  ...overrides,
});

const legacy = (widgets: Array<Record<string, unknown>>) => ({ version: 1, widgets });
const legacyWidget = (overrides: Record<string, unknown> = {}) => ({
  id: "sessions",
  source: "sessions",
  title: "Sessies",
  text: "Vandaag",
  display: "number",
  hidden: false,
  custom: false,
  ...overrides,
});

// ---------- Layout ----------

test("packing never overflows the grid and keeps reading order", () => {
  const packed = packLayout([
    widget({ id: "a", layout: { x: 0, y: 0, w: 6, h: 2 } }),
    widget({ id: "b", layout: { x: 0, y: 0, w: 6, h: 2 } }),
    widget({ id: "c", layout: { x: 0, y: 0, w: 12, h: 3 } }),
    widget({ id: "d", layout: { x: 0, y: 0, w: 3, h: 1 } }),
  ]);
  assert.deepEqual(packed.map((item) => [item.id, item.layout.x, item.layout.y]), [
    ["a", 0, 0],
    ["b", 6, 0],
    ["c", 0, 2],
    ["d", 0, 5],
  ]);
  for (const item of packed) assert.ok(item.layout.x + item.layout.w <= DASHBOARD_GRID_COLUMNS, item.id);
  assert.deepEqual(layoutOrder(packed).map((item) => item.id), ["a", "b", "c", "d"]);
});

test("a widget moves one place and the grid re-packs around it", () => {
  const start = packLayout([widget({ id: "a" }), widget({ id: "b" }), widget({ id: "c" })]);
  assert.deepEqual(layoutOrder(moveWidget(start, "c", -1)).map((item) => item.id), ["a", "c", "b"]);
  assert.deepEqual(layoutOrder(moveWidget(start, "a", -1)).map((item) => item.id), ["a", "b", "c"], "the first widget cannot move up");
  assert.deepEqual(layoutOrder(moveWidget(start, "c", 1)).map((item) => item.id), ["a", "b", "c"], "the last widget cannot move down");
});

test("resizing clamps to the grid and pushes the neighbours along", () => {
  const start = packLayout([widget({ id: "a" }), widget({ id: "b" })]);
  const resized = resizeWidget(start, "a", { w: 99 });
  assert.equal(resized.find((item) => item.id === "a")?.layout.w, DASHBOARD_GRID_COLUMNS);
  assert.equal(resized.find((item) => item.id === "b")?.layout.y, 1, "b drops to the next row");
});

// ---------- Duplicates ----------

test("two widgets showing the same thing are duplicates, whatever they are called", () => {
  const first = widget({ id: "sessions", display: { title: "Sessies" } });
  const second = widget({ id: "sessions-2", display: { title: "Bezoek vandaag" } });
  assert.equal(widgetFingerprint(first), widgetFingerprint(second));
  assert.deepEqual(findDuplicateWidgets([first, second], second).map((item) => item.id), ["sessions"]);

  const other = widget({ id: "views", metrics: [{ field: "views", aggregation: "sum" }] });
  assert.deepEqual(findDuplicateWidgets([first, other], other), []);
  const hiddenTwin = widget({ id: "sessions-3", hidden: true });
  assert.deepEqual(findDuplicateWidgets([hiddenTwin, first], first), [], "a hidden widget is not in the way");
});

test("the second of two identical widgets is hidden, not deleted", () => {
  const result = hideExactDuplicates([widget({ id: "sessions" }), widget({ id: "sessions-2" }), widget({ id: "views", metrics: [{ field: "views", aggregation: "sum" }] })]);
  assert.deepEqual(result.hiddenDuplicates, ["sessions-2"]);
  assert.equal(result.widgets.length, 3, "nothing is thrown away");
  assert.equal(result.widgets.find((item) => item.id === "sessions-2")?.hidden, true);
  assert.equal(result.widgets.find((item) => item.id === "sessions")?.hidden, false);
});

// ---------- Migration ----------

test("version 1 preferences keep their order, titles, hidden state and own widgets", () => {
  const stored = legacy([
    legacyWidget({ id: "views", source: "views", title: "Mijn weergaven", text: "" }),
    legacyWidget({ id: "sessions", source: "sessions", hidden: true }),
    legacyWidget({ id: "custom-abc", source: "dailyRevenue", title: "Eigen omzetgrafiek", text: "Zelf toegevoegd", display: "chart", custom: true }),
  ]);
  const { preferences, changed } = migratePreferences(stored);
  assert.equal(changed, true);
  assert.equal(preferences.version, 2);

  const order = layoutOrder(preferences.widgets).map((item) => item.id);
  assert.deepEqual(order.slice(0, 3), ["views", "sessions", "custom-abc"], "the admin's own order comes first");

  const views = preferences.widgets.find((item) => item.id === "views")!;
  assert.equal(views.display.title, "Mijn weergaven", "a renamed widget keeps its name");
  assert.equal(views.source, "ga4_traffic");
  assert.deepEqual(views.metrics, [{ field: "views", aggregation: "sum" }]);

  assert.equal(preferences.widgets.find((item) => item.id === "sessions")?.hidden, true);

  const own = preferences.widgets.find((item) => item.id === "custom-abc")!;
  assert.equal(own.custom, true);
  assert.equal(own.source, "mollie_revenue");
  assert.equal(own.visualization, "line", "the old chart switch becomes a real chart type");
  assert.equal(own.display.subtitle, "Zelf toegevoegd");
});

test("migration adds built-in widgets the admin has never seen", () => {
  const { preferences } = migratePreferences(legacy([legacyWidget()]));
  const ids = new Set(preferences.widgets.map((item) => item.id));
  for (const id of ["revenue-today", "funnel", "daily-revenue", "improvements"]) {
    assert.ok(ids.has(id), `${id} is added`);
  }
});

test("the two identical session widgets from version 1 survive as one visible widget", () => {
  const { preferences, hiddenDuplicates } = migratePreferences(
    legacy([legacyWidget({ id: "sessions" }), legacyWidget({ id: "custom-xyz", custom: true })]),
  );
  assert.deepEqual(hiddenDuplicates, ["custom-xyz"]);
  const visible = preferences.widgets.filter((item) => !item.hidden && item.source === "ga4_traffic" && item.metrics[0].field === "sessions");
  assert.equal(visible.length, 1);
});

test("unreadable or newer preferences fall back to the defaults instead of crashing", () => {
  for (const stored of [{ version: 99 }, { nonsense: true }, "tekst", 42]) {
    const { preferences } = migratePreferences(stored);
    assert.equal(preferences.version, 2);
    assert.ok(preferences.widgets.length > 0);
  }
  assert.equal(migratePreferences(null).changed, false, "a first visit is not a change worth saving");
});

test("the shipped defaults are valid, unique and fit the grid", () => {
  const defaults = defaultDashboardPreferences();
  const result = validatePreferences(defaults);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.problems));
  const fingerprints = defaults.widgets.map(widgetFingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length, "no two shipped widgets show the same thing");
});

// ---------- Visualization compatibility ----------

test("a chart is only offered when it fits the data", () => {
  const timeSeries = { shape: "timeSeries" as const, metricCount: 1, dimensionCount: 1 };
  const ids = compatibleVisualizations(timeSeries).map((item) => item.id);
  assert.ok(ids.includes("line") && ids.includes("bar_vertical"));
  assert.ok(!ids.includes("donut"), "a time series is not a part of a whole");
  assert.ok(!ids.includes("funnel"), "a time series is not a set of steps");
  assert.ok(!ids.includes("radar"));

  assert.equal(defaultVisualization(timeSeries), "line", "many points read better as a line");
  assert.equal(defaultVisualization({ shape: "steps", metricCount: 1, dimensionCount: 1 }), "funnel");
  assert.equal(defaultVisualization({ shape: "categorical", metricCount: 1, dimensionCount: 1 }), "bar_horizontal");
});

test("a chart refuses too few or too many measures, and says why", () => {
  const donut = getVisualization("donut")!;
  assert.match(visualizationProblem(donut, { shape: "categorical", metricCount: 1, dimensionCount: 1, categoryCount: 12 }) ?? "", /Overig/u);
  assert.equal(visualizationProblem(donut, { shape: "categorical", metricCount: 1, dimensionCount: 1, categoryCount: 4 }), null);

  const grouped = getVisualization("bar_grouped")!;
  assert.match(visualizationProblem(grouped, { shape: "categorical", metricCount: 1, dimensionCount: 1 }) ?? "", /ten minste 2/u);

  const funnel = getVisualization("funnel")!;
  assert.match(visualizationProblem(funnel, { shape: "timeSeries", metricCount: 1, dimensionCount: 1 }) ?? "", /past niet/u);

  const stacked = getVisualization("area_stacked")!;
  assert.match(visualizationProblem(stacked, { shape: "timeSeries", metricCount: 2, dimensionCount: 1, comparison: true }) ?? "", /geen vergelijking/u);
});

test("a long tail is summed into Overig instead of making an unreadable donut", () => {
  const slices = [
    { label: "A", value: 50 }, { label: "B", value: 30 }, { label: "C", value: 10 },
    { label: "D", value: 5 }, { label: "E", value: 3 }, { label: "F", value: 2 },
  ];
  const grouped = groupLongTail(slices, 5);
  assert.equal(grouped.length, 5);
  assert.deepEqual(grouped.at(-1), { label: "Overig", value: 5, isRest: true });
  assert.equal(grouped.reduce((sum, slice) => sum + slice.value, 0), 100, "nothing is lost");
  assert.equal(groupLongTail(slices.slice(0, 3), 5).length, 3, "a short list is left alone");
});

// ---------- Server-side validation ----------

test("a widget may only use fields its source offers", () => {
  assert.deepEqual(validateWidget(widget()), []);
  assert.match(validateWidget(widget({ source: "geheim" }))[0].message, /bestaat niet/u);
  assert.match(validateWidget(widget({ metrics: [{ field: "passwordHash", aggregation: "sum" }] }))[0].message, /geen meetwaarde/u);
  assert.match(validateWidget(widget({ dimensions: ["contactEmail"] }))[0].message, /geen groepering/u);
  assert.match(validateWidget(widget({ metrics: [{ field: "sessions", aggregation: "median" }] }))[0].message, /samengevat/u);
});

test("a filter is checked on field, comparison and value", () => {
  const base = widget({ source: "order_counts", metrics: [{ field: "orders", aggregation: "count" }] });
  assert.deepEqual(validateWidget({ ...base, filters: [{ field: "status", operator: "eq", value: "PAID" }] }), []);
  assert.match(validateWidget({ ...base, filters: [{ field: "contactEmail", operator: "eq", value: "a@b.nl" }] })[0].message, /kan niet worden gefilterd/u);
  assert.match(validateWidget({ ...base, filters: [{ field: "status", operator: "eq", value: "GEHEIM" }] })[0].message, /geen geldige waarde/u);
  assert.match(validateWidget({ ...base, filters: [{ field: "status", operator: "contains", value: "PAID" }] })[0].message, /vergelijking/u);
});

test("period, granularity and comparison must be offered by the source", () => {
  assert.match(validateWidget(widget({ source: "ga4_realtime", metrics: [{ field: "activeUsers", aggregation: "last" }], dateRange: { preset: "last_90_days" } }))[0].message, /periode/u);
  assert.match(validateWidget(widget({ granularity: "hour" }))[0].message, /per hour/u);
  const custom = validateWidget(widget({ dateRange: { preset: "custom", from: "2026-10-07", to: "2026-10-01" } }));
  assert.match(custom[0].message, /na de einddatum/u);
});

test("an impossible chart is refused server-side, not just hidden in the editor", () => {
  const problems = validateWidget(widget({ dimensions: ["date"], visualization: "funnel" }));
  assert.match(problems[0].message, /past niet bij deze databron/u);
  // A waterfall can show steps, but the funnel source does not offer it.
  assert.match(validateWidget(widget({ source: "ga4_funnel", metrics: [{ field: "reach", aggregation: "sum" }], dimensions: ["step"], visualization: "waterfall" }))[0].message, /biedt dit grafiektype niet/u);
  assert.match(validateWidget(widget({ source: "ga4_realtime", metrics: [{ field: "activeUsers", aggregation: "last" }], visualization: "line" }))[0].message, /past niet bij deze databron/u);
});

test("the whole dashboard is rejected on a duplicate id or a bad widget, with the widget named", () => {
  const ok = validatePreferences({ version: 2, widgets: [widget()] });
  assert.equal(ok.ok, true);

  const duplicate = validatePreferences({ version: 2, widgets: [widget({ id: "w1" }), widget({ id: "w1" })] });
  assert.equal(duplicate.ok, false);
  assert.ok(!duplicate.ok && duplicate.problems.some((problem) => /twee keer voor/u.test(problem.message)));

  const bad = validatePreferences({ version: 2, widgets: [widget({ id: "kapot", metrics: [{ field: "passwordHash", aggregation: "sum" }] })] });
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.problems[0].field.startsWith("kapot."), "the problem names the widget");

  assert.equal(validatePreferences({ version: 1, widgets: [] }).ok, false, "an old version is not accepted raw");
  assert.equal(validatePreferences({ version: 2, widgets: Array.from({ length: 41 }, (_, index) => widget({ id: `w${index}` })) }).ok, false, "a dashboard has a ceiling");
});

test("migration never writes a widget the server would refuse", () => {
  // Version 1 let an admin put any source in "chart" mode, including ones no chart fits.
  const sources = ["activeVisitors", "revenueToday", "sessions", "views", "engagement", "keyEvents", "activeProducts", "categories", "totalOrders", "pendingOrders", "recentOrders", "forecast", "dailyRevenue", "funnel", "improvementSignals", "improvements"];
  for (const source of sources) {
    for (const display of ["chart", "number"] as const) {
      const { preferences } = migratePreferences(legacy([legacyWidget({ id: "eigen-widget", source, display, custom: true })]));
      const migrated = preferences.widgets.find((item) => item.id === "eigen-widget");
      assert.ok(migrated, `${source} als ${display} blijft bestaan`);
      assert.deepEqual(validateWidget(migrated), [], `${source} als ${display} is geldig`);
    }
  }
});

test("a number shown as a chart in version 1 keeps its trend, a plain number does not", () => {
  const { preferences } = migratePreferences(legacy([
    legacyWidget({ id: "revenue-today", source: "revenueToday", display: "chart" }),
    legacyWidget({ id: "sessions", source: "sessions", display: "number" }),
  ]));
  const revenue = preferences.widgets.find((item) => item.id === "revenue-today")!;
  assert.equal(revenue.visualization, "kpi");
  assert.deepEqual(revenue.dimensions, ["date"], "grouped by day, so the sparkline returns");

  const sessions = preferences.widgets.find((item) => item.id === "sessions")!;
  assert.equal(sessions.visualization, "kpi");
  assert.deepEqual(sessions.dimensions, [], "a plain number stays a plain number");
});

test("a stored widget that went stale repairs itself instead of blocking every save", () => {
  const broken = widget({ id: "revenue-today", source: "mollie_revenue", metrics: [{ field: "netRevenue", aggregation: "sum" }], visualization: "line", dimensions: [] });
  const { preferences, changed } = migratePreferences({ version: 2, widgets: [broken] });
  assert.equal(changed, true);
  const repaired = preferences.widgets.find((item) => item.id === "revenue-today")!;
  assert.notEqual(repaired.visualization, "line", "a line without a grouping cannot be drawn");
  assert.deepEqual(validateWidget(repaired), []);
  assert.equal(validatePreferences(preferences).ok, true, "and the whole dashboard saves again");
});
