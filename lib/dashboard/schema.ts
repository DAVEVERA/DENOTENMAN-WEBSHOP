// The dashboard widget contract, version 2. A widget is a declarative description of what
// to show: which approved data source, which measures, how to group and filter, over which
// period, and as which visualization. Admins never write SQL, Prisma or expressions; the
// server validates every field against the source registry (lib/dashboard/sources.ts).
//
// Version 1 (lib/admin-dashboard-contract.ts) was flat: one source, a title, a line of text
// and a number/chart switch. Saved v1 preferences are migrated in lib/dashboard/migrate.ts,
// so nobody loses their layout.

export const DASHBOARD_SCHEMA_VERSION = 2 as const;

/** The grid is twelve columns wide; a row is one unit high. */
export const DASHBOARD_GRID_COLUMNS = 12;

export type WidgetScope = "personal" | "shared";

export const AGGREGATIONS = ["sum", "avg", "min", "max", "count", "count_distinct", "median", "p90", "last"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];

export const FILTER_OPERATORS = ["eq", "ne", "in", "not_in", "gt", "gte", "lt", "lte", "contains"] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const DATE_PRESETS = ["today", "yesterday", "last_7_days", "last_28_days", "last_30_days", "last_90_days", "this_month", "last_month", "this_year", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const GRANULARITIES = ["hour", "day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const COMPARISONS = ["none", "previous_period", "previous_year"] as const;
export type Comparison = (typeof COMPARISONS)[number];

/** How a number is written out; the formatter lives in lib/dashboard/format.ts. */
export const NUMBER_FORMATS = ["integer", "decimal", "euro", "percent", "duration_hours", "compact"] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

export type WidgetMetric = { field: string; aggregation: Aggregation };

export type FilterValue = string | number | boolean | string[] | number[];
export type WidgetFilter = { field: string; operator: FilterOperator; value: FilterValue };

export type WidgetDateRange = {
  preset: DatePreset;
  /** Only for preset "custom", as YYYY-MM-DD in Europe/Amsterdam. */
  from?: string;
  to?: string;
};

/** Bands that colour a value. The band also decides the label and icon, never colour alone. */
export type WidgetThreshold = { at: number; tone: "good" | "warn" | "bad" };

export type WidgetLayout = { x: number; y: number; w: number; h: number };

export type DashboardWidgetConfig = {
  schemaVersion: typeof DASHBOARD_SCHEMA_VERSION;
  id: string;
  /** The admin this widget belongs to; null for a shared template. */
  ownerId: string | null;
  scope: WidgetScope;
  source: string;
  metrics: WidgetMetric[];
  dimensions: string[];
  filters: WidgetFilter[];
  dateRange: WidgetDateRange;
  granularity?: Granularity;
  comparison: Comparison;
  visualization: string;
  display: {
    title: string;
    subtitle?: string;
    format?: NumberFormat;
    thresholds?: WidgetThreshold[];
  };
  layout: WidgetLayout;
  hidden: boolean;
  /** False for the widgets the dashboard ships with, true for anything an admin made. */
  custom: boolean;
};

export type DashboardPreferences = {
  version: typeof DASHBOARD_SCHEMA_VERSION;
  widgets: DashboardWidgetConfig[];
};

// ---------- Duplicates ----------

/**
 * What makes two widgets the same piece of information. The title is deliberately left out:
 * renaming a copy does not make it a different widget.
 */
export function widgetFingerprint(widget: DashboardWidgetConfig): string {
  const metrics = widget.metrics.map((metric) => `${metric.field}:${metric.aggregation}`).sort();
  const filters = widget.filters
    .map((filter) => `${filter.field}${filter.operator}${JSON.stringify(filter.value)}`)
    .sort();
  return JSON.stringify([
    widget.source,
    metrics,
    [...widget.dimensions].sort(),
    filters,
    widget.dateRange.preset,
    widget.dateRange.from ?? "",
    widget.dateRange.to ?? "",
    widget.granularity ?? "",
    widget.comparison,
    widget.visualization,
  ]);
}

/** The visible widgets that show exactly the same thing as `widget`, excluding itself. */
export function findDuplicateWidgets(
  widgets: readonly DashboardWidgetConfig[],
  widget: DashboardWidgetConfig,
): DashboardWidgetConfig[] {
  const fingerprint = widgetFingerprint(widget);
  return widgets.filter((other) => other.id !== widget.id && !other.hidden && widgetFingerprint(other) === fingerprint);
}

// ---------- Layout ----------

/** Puts every widget on the first free spot, left to right, top to bottom. */
export function packLayout(widgets: readonly DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return widgets.map((widget) => {
    const w = Math.min(Math.max(1, widget.layout.w), DASHBOARD_GRID_COLUMNS);
    const h = Math.max(1, widget.layout.h);
    if (x + w > DASHBOARD_GRID_COLUMNS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...widget, layout: { x, y, w, h } };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return placed;
  });
}

/** Reading order: top row first, then left to right. Used for mobile and for keyboard moves. */
export function layoutOrder(widgets: readonly DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  return [...widgets].sort((left, right) => left.layout.y - right.layout.y || left.layout.x - right.layout.x);
}

/** Moves a widget one place earlier or later in reading order and re-packs the grid. */
export function moveWidget(
  widgets: readonly DashboardWidgetConfig[],
  id: string,
  direction: -1 | 1,
): DashboardWidgetConfig[] {
  const ordered = layoutOrder(widgets);
  const index = ordered.findIndex((widget) => widget.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return [...widgets];
  const reordered = [...ordered];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return packLayout(reordered);
}

/** Resizes one widget within the grid and re-packs, so nothing overlaps. */
export function resizeWidget(
  widgets: readonly DashboardWidgetConfig[],
  id: string,
  size: { w?: number; h?: number },
): DashboardWidgetConfig[] {
  return packLayout(
    layoutOrder(widgets).map((widget) =>
      widget.id === id
        ? { ...widget, layout: { ...widget.layout, w: size.w ?? widget.layout.w, h: size.h ?? widget.layout.h } }
        : widget,
    ),
  );
}
