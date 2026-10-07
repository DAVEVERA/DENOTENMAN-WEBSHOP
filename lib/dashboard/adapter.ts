// Turns a declared widget into what the dashboard should actually draw. This is the seam
// between the configuration an admin makes and the data the server already fetched, and it
// is pure so every mapping is testable: which number, which series, which deep link, and
// which honest state when a source has nothing to say.

import type { DashboardAnalytics } from "@/lib/admin-dashboard-contract";
import { describeChange, shortDay, type Change } from "./format";
import { getDashboardSource } from "./sources";
import type { ChartData, Series } from "./series";
import type { DashboardWidgetConfig, NumberFormat } from "./schema";

export type WidgetContext = {
  analytics: DashboardAnalytics;
  commerce: { activeProducts: number; categories: number; totalOrders: number; pendingOrders: number };
  recentOrdersCount: number;
};

export type WidgetView =
  | { kind: "kpi"; value: number | null; format: NumberFormat; change: Change | null; trend?: Series; href?: string; hero: boolean }
  | { kind: "timeSeries"; data: ChartData; variant: "line" | "area" | "bar"; periodLabel: string }
  | { kind: "funnel"; steps: Array<{ label: string; value: number | null }>; comparable: boolean }
  | { kind: "bar"; data: ChartData; direction: "horizontal" | "vertical"; categoryLabel: string }
  /** Rendered by a hand-built component because it is a list of links, not a chart. */
  | { kind: "recentOrders" }
  | { kind: "signals" }
  | { kind: "issues" }
  | { kind: "unavailable"; state: "empty" | "not_measured" | "error"; message?: string };

const HERO_WIDGETS = new Set(["active-visitors", "revenue-today"]);

/** Where clicking a widget takes you, when a filtered view of the same thing exists. */
export function widgetDeepLink(widget: DashboardWidgetConfig): string | undefined {
  if (widget.source === "catalog_counts") {
    return widget.metrics[0]?.field === "activeCategories" ? "/admin/categorieen" : "/admin/producten";
  }
  if (widget.source === "order_counts") {
    const status = widget.filters.find((filter) => filter.field === "status" && filter.operator === "eq");
    return status ? `/admin/bestellingen?status=${String(status.value)}` : "/admin/bestellingen";
  }
  if (widget.source === "recent_orders") return "/admin/bestellingen";
  if (widget.source === "mollie_revenue") return "/admin/facturen";
  return getDashboardSource(widget.source)?.deepLink;
}

function metricFormat(widget: DashboardWidgetConfig, fallback: NumberFormat = "integer"): NumberFormat {
  if (widget.display.format) return widget.display.format;
  const source = getDashboardSource(widget.source);
  const field = widget.metrics[0]?.field;
  return source?.metrics.find((metric) => metric.field === field)?.format ?? fallback;
}

/** How many days a period covers, for reading a stored history. */
export function periodDays(preset: string, available: number): number {
  switch (preset) {
    case "today":
    case "yesterday":
      return 1;
    case "last_7_days":
      return 7;
    case "last_28_days":
      return 28;
    case "last_30_days":
    case "this_month":
    case "last_month":
      return 30;
    case "last_90_days":
      return 90;
    case "this_year":
      return available;
    default:
      return Math.min(30, available);
  }
}

/** The window a KPI covers and the window before it, for an honest comparison. */
function windows<T>(points: readonly T[], days: number): { current: T[]; previous: T[] } {
  const current = points.slice(-days);
  const previous = points.slice(-days * 2, -days);
  return { current, previous };
}

function sum(values: ReadonlyArray<number | null>): number | null {
  const measured = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return measured.length ? measured.reduce((total, value) => total + value, 0) : null;
}

/** The scalar a KPI widget shows, or null when that measure was not collected. */
function scalarValue(widget: DashboardWidgetConfig, context: WidgetContext): number | null {
  const field = widget.metrics[0]?.field;
  const { analytics, commerce } = context;
  switch (widget.source) {
    case "ga4_realtime":
      return analytics.metrics.activeVisitors;
    case "ga4_traffic": {
      // Only sessions are kept per day; the other measures exist for today only.
      if (field === "sessions" && widget.dateRange.preset !== "today") {
        const days = periodDays(widget.dateRange.preset, analytics.daily.length);
        return sum(windows(analytics.daily, days).current.map((point) => point.sessions));
      }
      return field === "views" ? analytics.metrics.views
        : field === "engagementRate" ? analytics.metrics.engagement
          : field === "keyEvents" ? analytics.metrics.keyEvents
            : analytics.metrics.sessions;
    }
    case "mollie_revenue": {
      if (field !== "netRevenue") return null;
      // Only a "today" widget shows today's live figure; a longer period is a real total.
      if (widget.dateRange.preset === "today") return analytics.metrics.revenueToday;
      const days = periodDays(widget.dateRange.preset, analytics.revenueDaily.length);
      return sum(windows(analytics.revenueDaily, days).current.map((point) => point.revenue));
    }
    case "catalog_counts":
      return field === "activeCategories" ? commerce.categories : commerce.activeProducts;
    case "order_counts":
      return widget.filters.some((filter) => filter.field === "status" && filter.value === "PENDING")
        ? commerce.pendingOrders
        : commerce.totalOrders;
    case "analysis_signals":
      return analytics.signals.critical + analytics.signals.high;
    default:
      return null;
  }
}

/** The day-by-day history behind a measure, used both to compare periods and to draw a trend. */
function historySeries(widget: DashboardWidgetConfig, context: WidgetContext): Series | undefined {
  const { analytics } = context;
  if (widget.source === "mollie_revenue" && widget.metrics[0]?.field === "netRevenue") {
    return {
      key: "netRevenue",
      label: "Netto omzet",
      format: "euro",
      points: analytics.revenueDaily.map((point) => ({ label: shortDay(point.date), value: point.revenue, partial: point.partial })),
    };
  }
  if (widget.source === "ga4_traffic" && widget.metrics[0]?.field === "sessions") {
    return {
      key: "sessions",
      label: "Sessies",
      format: "integer",
      points: analytics.daily.map((point) => ({ label: shortDay(point.date), value: point.sessions, partial: point.partial })),
    };
  }
  return undefined;
}

/**
 * The change against the comparison period, worked out from the history the payload already
 * holds. Without enough history there is no comparison, and the widget then shows none.
 */
function trendChange(widget: DashboardWidgetConfig, trend: Series | undefined, format: NumberFormat): Change | null {
  if (widget.comparison === "none" || !trend) return null;
  // A period that is still running cannot be compared with a finished one: an hour into the
  // day every number looks like a collapse. Better to show no percentage than a false one.
  const running = new Set(["today", "this_month", "this_year"]);
  if (running.has(widget.dateRange.preset)) return null;
  const complete = trend.points.filter((point) => !point.partial && point.value !== null);
  const days = periodDays(widget.dateRange.preset, complete.length);
  // Both windows must be whole, otherwise the comparison flatters or punishes the result.
  if (complete.length < days * 2) return null;
  const { current, previous } = windows(complete, days);
  return describeChange(sum(current.map((point) => point.value)), sum(previous.map((point) => point.value)), format);
}

function revenueSeries(widget: DashboardWidgetConfig, context: WidgetContext): ChartData {
  const days = widget.dateRange.preset === "last_90_days" ? 90 : widget.dateRange.preset === "last_7_days" ? 7 : 30;
  const points = context.analytics.revenueDaily.slice(-days);
  return {
    categories: points.map((point) => shortDay(point.date)),
    series: [{
      key: "netRevenue",
      label: "Netto omzet",
      format: "euro",
      points: points.map((point) => ({ label: shortDay(point.date), value: point.revenue, partial: point.partial })),
    }],
  };
}

function trafficSeries(widget: DashboardWidgetConfig, context: WidgetContext): ChartData {
  const days = widget.dateRange.preset === "last_90_days" ? 90 : widget.dateRange.preset === "last_7_days" ? 7 : 30;
  const points = context.analytics.daily.slice(-days);
  const field = widget.metrics[0]?.field ?? "sessions";
  return {
    categories: points.map((point) => shortDay(point.date)),
    series: [{
      key: field,
      label: getDashboardSource("ga4_traffic")?.metrics.find((metric) => metric.field === field)?.label ?? "Sessies",
      format: metricFormat(widget),
      points: points.map((point) => ({ label: shortDay(point.date), value: point.sessions, partial: point.partial })),
    }],
  };
}

function forecastSeries(context: WidgetContext): ChartData {
  const points = context.analytics.forecast.points;
  return {
    categories: points.map((point) => shortDay(point.date)),
    series: [
      { key: "expected", label: "Verwacht", format: "integer", points: points.map((point) => ({ label: shortDay(point.date), value: point.expected })) },
      { key: "low", label: "Ondergrens", format: "integer", points: points.map((point) => ({ label: shortDay(point.date), value: point.low })) },
      { key: "high", label: "Bovengrens", format: "integer", points: points.map((point) => ({ label: shortDay(point.date), value: point.high })) },
    ],
  };
}

const PERIOD_LABELS: Record<string, string> = {
  today: "vandaag",
  yesterday: "gisteren",
  last_7_days: "afgelopen 7 dagen",
  last_28_days: "afgelopen 28 dagen",
  last_30_days: "afgelopen 30 dagen",
  last_90_days: "afgelopen 90 dagen",
  this_month: "deze maand",
  last_month: "vorige maand",
  this_year: "dit jaar",
  custom: "gekozen periode",
};

export function periodLabel(widget: DashboardWidgetConfig): string {
  if (widget.dateRange.preset === "custom" && widget.dateRange.from && widget.dateRange.to) {
    return `${widget.dateRange.from} tot en met ${widget.dateRange.to}`;
  }
  return PERIOD_LABELS[widget.dateRange.preset] ?? widget.dateRange.preset;
}

/** Where the numbers came from, shown on the widget so a reader can judge them. */
export function originLabel(widget: DashboardWidgetConfig): string {
  return getDashboardSource(widget.source)?.origin ?? "Webshop";
}

export function buildWidgetView(widget: DashboardWidgetConfig, context: WidgetContext): WidgetView {
  const source = getDashboardSource(widget.source);
  if (!source) return { kind: "unavailable", state: "error", message: "Deze databron bestaat niet meer." };

  const analyticsDown = context.analytics.status === "unavailable";
  const needsAnalytics = source.category === "verkeer" || widget.source === "mollie_revenue";
  if (needsAnalytics && analyticsDown) {
    return { kind: "unavailable", state: "not_measured", message: context.analytics.message };
  }

  switch (widget.visualization) {
    case "kpi": {
      // The signals widget is three severity cards, not one bare number.
      if (widget.source === "analysis_signals") return { kind: "signals" };
      const format = metricFormat(widget);
      const history = historySeries(widget, context);
      return {
        kind: "kpi",
        value: scalarValue(widget, context),
        format,
        change: trendChange(widget, history, format),
        // The trend is only drawn when the widget asks to be grouped by day.
        trend: widget.dimensions.includes("date") ? history : undefined,
        href: widgetDeepLink(widget),
        hero: HERO_WIDGETS.has(widget.id),
      };
    }
    case "line":
    case "area":
    case "bar_vertical": {
      const data = widget.source === "ga4_forecast"
        ? forecastSeries(context)
        : widget.source === "mollie_revenue"
          ? revenueSeries(widget, context)
          : trafficSeries(widget, context);
      if (!data.categories.length) {
        const reason = widget.source === "ga4_forecast" ? context.analytics.forecast.reason : undefined;
        return { kind: "unavailable", state: "empty", message: reason };
      }
      const variant = widget.visualization === "bar_vertical" ? "bar" : widget.visualization;
      return { kind: "timeSeries", data, variant, periodLabel: periodLabel(widget) };
    }
    case "funnel": {
      const { funnel } = context.analytics;
      const steps = [
        { label: "In winkelwagen", value: funnel.cart },
        { label: "Checkout gestart", value: funnel.checkout },
        { label: "Aankoopsignaal", value: funnel.purchase },
      ];
      if (steps.every((step) => step.value === null)) return { kind: "unavailable", state: "not_measured" };
      // Until the funnel counts unique sessions, it counts events and the widget says so.
      return { kind: "funnel", steps, comparable: false };
    }
    case "table": {
      if (widget.source === "recent_orders") {
        return context.recentOrdersCount === 0 ? { kind: "unavailable", state: "empty", message: "Nog geen bestellingen." } : { kind: "recentOrders" };
      }
      if (widget.source === "analysis_signals") {
        return context.analytics.issues.length === 0
          ? { kind: "unavailable", state: "empty", message: "Zodra er voldoende meetgegevens zijn, verschijnen hier concrete verbeterpunten." }
          : { kind: "issues" };
      }
      return { kind: "unavailable", state: "empty" };
    }
    case "bar_horizontal": {
      if (widget.source === "analysis_signals") return { kind: "signals" };
      return { kind: "unavailable", state: "empty" };
    }
    default:
      return { kind: "unavailable", state: "error", message: "Dit grafiektype kan deze bron nog niet tonen." };
  }
}
