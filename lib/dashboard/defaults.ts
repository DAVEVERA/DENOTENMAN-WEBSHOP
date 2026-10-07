// The widget set the dashboard ships with, and the table that maps every version 1 widget
// onto its version 2 form. Both live here so a built-in widget and its migrated counterpart
// can never drift apart.

import {
  DASHBOARD_SCHEMA_VERSION,
  packLayout,
  type DashboardPreferences,
  type DashboardWidgetConfig,
} from "./schema";

/** A built-in widget, before the grid positions it. */
type Builtin = Omit<DashboardWidgetConfig, "schemaVersion" | "ownerId" | "scope" | "layout" | "hidden" | "custom"> & {
  size: { w: number; h: number };
};

/** Three columns wide, one row high: the size of a plain number card. */
const CARD = { w: 3, h: 1 };
/** Half the grid, two rows high: the two numbers that matter most at a glance. */
const HERO = { w: 6, h: 2 };
/** The full width, for charts, tables and lists. */
const WIDE = { w: 12, h: 3 };

export const BUILTIN_WIDGETS: readonly Builtin[] = [
  {
    id: "active-visitors",
    source: "ga4_realtime",
    metrics: [{ field: "activeUsers", aggregation: "last" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Actieve bezoekers", subtitle: "Afgelopen 30 minuten", format: "integer" },
    size: HERO,
  },
  {
    id: "revenue-today",
    source: "mollie_revenue",
    metrics: [{ field: "netRevenue", aggregation: "sum" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "previous_period",
    visualization: "kpi",
    display: { title: "Omzet vandaag", subtitle: "Netto betaalde Mollie-omzet", format: "euro" },
    size: HERO,
  },
  {
    id: "sessions",
    source: "ga4_traffic",
    metrics: [{ field: "sessions", aggregation: "sum" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "previous_period",
    visualization: "kpi",
    display: { title: "Sessies", subtitle: "Vandaag", format: "integer" },
    size: CARD,
  },
  {
    id: "views",
    source: "ga4_traffic",
    metrics: [{ field: "views", aggregation: "sum" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "previous_period",
    visualization: "kpi",
    display: { title: "Weergaven", subtitle: "Vandaag", format: "integer" },
    size: CARD,
  },
  {
    id: "engagement",
    source: "ga4_traffic",
    metrics: [{ field: "engagementRate", aggregation: "avg" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "previous_period",
    visualization: "kpi",
    display: { title: "Betrokkenheid", subtitle: "Betrokken sessies / sessies", format: "percent" },
    size: CARD,
  },
  {
    id: "key-events",
    source: "ga4_traffic",
    metrics: [{ field: "keyEvents", aggregation: "sum" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "previous_period",
    visualization: "kpi",
    display: { title: "Belangrijke events", subtitle: "Vandaag", format: "integer" },
    size: CARD,
  },
  {
    id: "active-products",
    source: "catalog_counts",
    metrics: [{ field: "activeProducts", aggregation: "last" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Actieve producten", format: "integer" },
    size: CARD,
  },
  {
    id: "categories",
    source: "catalog_counts",
    metrics: [{ field: "activeCategories", aggregation: "last" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Categorieën", format: "integer" },
    size: CARD,
  },
  {
    id: "total-orders",
    source: "order_counts",
    metrics: [{ field: "orders", aggregation: "count" }],
    dimensions: [],
    filters: [],
    dateRange: { preset: "this_year" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Bestellingen totaal", format: "integer" },
    size: CARD,
  },
  {
    id: "pending-orders",
    source: "order_counts",
    metrics: [{ field: "orders", aggregation: "count" }],
    dimensions: [],
    filters: [{ field: "status", operator: "eq", value: "PENDING" }],
    dateRange: { preset: "this_year" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Openstaand", format: "integer" },
    size: CARD,
  },
  {
    id: "recent-orders",
    source: "recent_orders",
    metrics: [{ field: "total", aggregation: "sum" }],
    dimensions: ["order"],
    filters: [],
    dateRange: { preset: "last_30_days" },
    comparison: "none",
    visualization: "table",
    display: { title: "Recente bestellingen", subtitle: "De acht nieuwste bestellingen", format: "euro" },
    size: WIDE,
  },
  {
    id: "forecast",
    source: "ga4_forecast",
    metrics: [
      { field: "expected", aggregation: "sum" },
      { field: "low", aggregation: "sum" },
      { field: "high", aggregation: "sum" },
    ],
    dimensions: ["date"],
    filters: [],
    dateRange: { preset: "today" },
    granularity: "day",
    comparison: "none",
    visualization: "area",
    display: { title: "Forecast", subtitle: "Verwachte sessies voor de komende zeven dagen", format: "integer" },
    size: WIDE,
  },
  {
    id: "daily-revenue",
    source: "mollie_revenue",
    metrics: [{ field: "netRevenue", aggregation: "sum" }],
    dimensions: ["date"],
    filters: [],
    dateRange: { preset: "last_30_days" },
    granularity: "day",
    comparison: "previous_period",
    visualization: "line",
    display: { title: "Omzet per dag", subtitle: "Mollie, netto na refunds en chargebacks", format: "euro" },
    size: WIDE,
  },
  {
    id: "funnel",
    source: "ga4_funnel",
    metrics: [{ field: "reach", aggregation: "sum" }],
    dimensions: ["step"],
    filters: [],
    dateRange: { preset: "last_28_days" },
    comparison: "none",
    visualization: "funnel",
    display: { title: "Van winkelwagen naar aankoop", format: "integer" },
    size: WIDE,
  },
  {
    id: "improvement-signals",
    source: "analysis_signals",
    metrics: [{ field: "findings", aggregation: "count" }],
    dimensions: ["severity"],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "none",
    visualization: "kpi",
    display: { title: "Verbetersignalen", subtitle: "Eerst oplossen, deze sprint en verder uitbouwen", format: "integer" },
    size: WIDE,
  },
  {
    id: "improvements",
    source: "analysis_signals",
    metrics: [{ field: "findings", aggregation: "count" }],
    dimensions: ["severity"],
    filters: [],
    dateRange: { preset: "today" },
    comparison: "none",
    visualization: "table",
    display: { title: "Verbeterpunten", subtitle: "Acties op basis van de actuele meetgegevens", format: "integer" },
    size: WIDE,
  },
];

export const BUILTIN_WIDGET_IDS: ReadonlySet<string> = new Set(BUILTIN_WIDGETS.map((widget) => widget.id));

export function builtinWidget(id: string): Builtin | undefined {
  return BUILTIN_WIDGETS.find((widget) => widget.id === id);
}

/** One built-in turned into a full widget, before packing. */
export function materializeBuiltin(builtin: Builtin): DashboardWidgetConfig {
  const { size, ...rest } = builtin;
  return {
    ...rest,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    ownerId: null,
    scope: "personal",
    layout: { x: 0, y: 0, ...size },
    hidden: false,
    custom: false,
  };
}

export function defaultDashboardPreferences(): DashboardPreferences {
  return {
    version: DASHBOARD_SCHEMA_VERSION,
    widgets: packLayout(BUILTIN_WIDGETS.map(materializeBuiltin)),
  };
}
