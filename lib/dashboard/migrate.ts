// Turns saved preferences of any earlier version into the current schema. An admin who opens
// the dashboard after a deploy keeps their own order, their hidden widgets and the widgets
// they added themselves; nothing is silently dropped and nothing is silently duplicated.

import {
  DASHBOARD_SCHEMA_VERSION,
  findDuplicateWidgets,
  packLayout,
  type DashboardPreferences,
  type DashboardWidgetConfig,
} from "./schema";
import { BUILTIN_WIDGETS, builtinWidget, materializeBuiltin, defaultDashboardPreferences } from "./defaults";
import { getDashboardSource } from "./sources";
import { defaultVisualization, getVisualization, visualizationProblem } from "./visualizations";

/** The version 1 widget, kept here so the old shape lives in one place. */
type LegacyWidget = {
  id: string;
  source: string;
  title: string;
  text: string;
  display: "number" | "chart";
  hidden: boolean;
  custom: boolean;
};

type LegacyPreferences = { version: 1; widgets: LegacyWidget[] };

/**
 * Where a version 1 source ends up. A custom widget the admin added by picking a source gets
 * the same treatment as the built-in widget for that source, which is why this maps to a
 * built-in id rather than repeating the fields.
 */
const LEGACY_SOURCE_TO_BUILTIN: Readonly<Record<string, string>> = {
  activeVisitors: "active-visitors",
  revenueToday: "revenue-today",
  sessions: "sessions",
  views: "views",
  engagement: "engagement",
  keyEvents: "key-events",
  activeProducts: "active-products",
  categories: "categories",
  totalOrders: "total-orders",
  pendingOrders: "pending-orders",
  recentOrders: "recent-orders",
  forecast: "forecast",
  dailyRevenue: "daily-revenue",
  funnel: "funnel",
  improvementSignals: "improvement-signals",
  improvements: "improvements",
};

/**
 * What the version 1 "chart" switch meant per source. For a plain number it meant a number
 * with a trend behind it, which in version 2 is a KPI grouped by day; for the wide widgets
 * it meant the real chart.
 */
const LEGACY_CHART_VISUALIZATION: Readonly<Record<string, string>> = {
  sessions: "kpi",
  revenueToday: "kpi",
  forecast: "area",
  dailyRevenue: "line",
  funnel: "funnel",
};

const LEGACY_NUMBER_VISUALIZATION: Readonly<Record<string, string>> = {
  sessions: "kpi",
  revenueToday: "kpi",
  forecast: "area",
  dailyRevenue: "kpi",
  funnel: "funnel",
};

/** Sources where the version 1 switch decided whether a trend was drawn behind the number. */
const TREND_BY_CHOICE = new Set(["sessions", "revenueToday", "dailyRevenue"]);

/**
 * Falls back to the built-in chart when a carried-over choice does not fit the data. The
 * migration can then never write a widget the server would refuse to save.
 */
function safeVisualization(widget: DashboardWidgetConfig, fallback: string): string {
  const source = getDashboardSource(widget.source);
  if (!source) return fallback;
  const request = {
    shape: source.shape,
    metricCount: widget.metrics.length,
    dimensionCount: widget.dimensions.length,
    comparison: widget.comparison !== "none",
    allowed: source.onlyVisualizations,
  };
  const chosen = getVisualization(widget.visualization);
  if (chosen && visualizationProblem(chosen, request) === null) return widget.visualization;
  const backup = getVisualization(fallback);
  if (backup && visualizationProblem(backup, request) === null) return fallback;
  return defaultVisualization(request);
}

function isLegacy(value: unknown): value is LegacyPreferences {
  return (
    typeof value === "object" && value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { widgets?: unknown }).widgets)
  );
}

/** One version 1 widget as a version 2 widget, keeping the admin's own title and text. */
function upgradeWidget(legacy: LegacyWidget): DashboardWidgetConfig | null {
  const builtinId = LEGACY_SOURCE_TO_BUILTIN[legacy.source];
  const builtin = builtinId ? builtinWidget(builtinId) : undefined;
  if (!builtin) return null;
  const base = materializeBuiltin(builtin);
  const visualization = legacy.display === "chart"
    ? LEGACY_CHART_VISUALIZATION[legacy.source] ?? base.visualization
    : LEGACY_NUMBER_VISUALIZATION[legacy.source] ?? base.visualization;
  // A chart needs room; a bare number does not.
  const size = visualization === "kpi"
    ? { w: Math.min(base.layout.w, 6), h: Math.min(base.layout.h, 2) }
    : { w: base.layout.w, h: base.layout.h };
  // Grouping by day is what makes a number show its trend, so the old switch maps onto it.
  const dimensions = TREND_BY_CHOICE.has(legacy.source) && visualization === "kpi"
    ? (legacy.display === "chart" ? ["date"] : [])
    : base.dimensions;
  return {
    ...base,
    id: legacy.id,
    visualization: safeVisualization({ ...base, visualization, dimensions }, builtin.visualization),
    dimensions,
    display: {
      ...base.display,
      title: legacy.title.trim() || base.display.title,
      // An admin who cleared the text meant to clear it; only an untouched default is refreshed.
      subtitle: legacy.custom ? legacy.text || undefined : legacy.text || base.display.subtitle,
    },
    layout: { x: 0, y: 0, ...size },
    hidden: legacy.hidden,
    custom: legacy.custom,
  };
}

/**
 * Adds the built-in widgets an admin has never seen, so a new default widget shows up after a
 * deploy instead of staying invisible forever.
 */
function appendMissingBuiltins(widgets: DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  const seen = new Set(widgets.map((widget) => widget.id));
  const missing = BUILTIN_WIDGETS.filter((builtin) => !seen.has(builtin.id)).map(materializeBuiltin);
  return [...widgets, ...missing];
}

/**
 * Hides, rather than deletes, the second of two widgets that show exactly the same thing. The
 * version 1 editor could add the same source twice, so saved preferences really do contain
 * these; hiding keeps the admin's own copy recoverable instead of throwing it away.
 */
export function hideExactDuplicates(widgets: readonly DashboardWidgetConfig[]): {
  widgets: DashboardWidgetConfig[];
  hiddenDuplicates: string[];
} {
  const result: DashboardWidgetConfig[] = [];
  const hiddenDuplicates: string[] = [];
  for (const widget of widgets) {
    if (!widget.hidden && findDuplicateWidgets(result, widget).length > 0) {
      result.push({ ...widget, hidden: true });
      hiddenDuplicates.push(widget.id);
      continue;
    }
    result.push(widget);
  }
  return { widgets: result, hiddenDuplicates };
}

export type MigrationResult = {
  preferences: DashboardPreferences;
  /** True when the stored value had to change, so the caller can write it back once. */
  changed: boolean;
  /** Ids of widgets that were hidden because an identical one was already visible. */
  hiddenDuplicates: string[];
};

/** Brings any stored preferences to the current schema. Unreadable input falls back to the defaults. */
export function migratePreferences(stored: unknown): MigrationResult {
  if (stored === null || stored === undefined) {
    return { preferences: defaultDashboardPreferences(), changed: false, hiddenDuplicates: [] };
  }

  if (isLegacy(stored)) {
    const upgraded = stored.widgets
      .map(upgradeWidget)
      .filter((widget): widget is DashboardWidgetConfig => widget !== null);
    const deduplicated = hideExactDuplicates(appendMissingBuiltins(upgraded));
    return {
      preferences: { version: DASHBOARD_SCHEMA_VERSION, widgets: packLayout(deduplicated.widgets) },
      changed: true,
      hiddenDuplicates: deduplicated.hiddenDuplicates,
    };
  }

  const version = (stored as { version?: unknown }).version;
  const widgets = (stored as { widgets?: unknown }).widgets;
  if (version !== DASHBOARD_SCHEMA_VERSION || !Array.isArray(widgets)) {
    return { preferences: defaultDashboardPreferences(), changed: true, hiddenDuplicates: [] };
  }

  const stored2 = widgets as DashboardWidgetConfig[];
  // A widget can go stale when a source changes what it offers; repair it rather than let
  // every save fail on it from then on.
  const current = stored2.map((widget) => {
    const repaired = safeVisualization(widget, builtinWidget(widget.id)?.visualization ?? widget.visualization);
    return repaired === widget.visualization ? widget : { ...widget, visualization: repaired };
  });
  const repairs = current.filter((widget, index) => widget !== stored2[index]).length;
  const deduplicated = hideExactDuplicates(appendMissingBuiltins(current));
  const changed = repairs > 0 || deduplicated.hiddenDuplicates.length > 0 || deduplicated.widgets.length !== current.length;
  return {
    preferences: { version: DASHBOARD_SCHEMA_VERSION, widgets: packLayout(deduplicated.widgets) },
    changed,
    hiddenDuplicates: deduplicated.hiddenDuplicates,
  };
}
