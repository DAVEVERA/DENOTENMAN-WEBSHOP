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

/** Sources whose version 1 "chart" switch had a real meaning worth carrying over. */
const LEGACY_CHART_VISUALIZATION: Readonly<Record<string, string>> = {
  sessions: "line",
  revenueToday: "line",
  forecast: "area",
  dailyRevenue: "line",
  funnel: "funnel",
};

const LEGACY_NUMBER_VISUALIZATION: Readonly<Record<string, string>> = {
  sessions: "kpi",
  revenueToday: "kpi",
  forecast: "table",
  dailyRevenue: "kpi",
  funnel: "table",
};

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
  return {
    ...base,
    id: legacy.id,
    visualization,
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

  const current = widgets as DashboardWidgetConfig[];
  const deduplicated = hideExactDuplicates(appendMissingBuiltins(current));
  const changed = deduplicated.hiddenDuplicates.length > 0 || deduplicated.widgets.length !== current.length;
  return {
    preferences: { version: DASHBOARD_SCHEMA_VERSION, widgets: packLayout(deduplicated.widgets) },
    changed,
    hiddenDuplicates: deduplicated.hiddenDuplicates,
  };
}
