// Server-side validation of a widget. Everything an admin can choose is checked against the
// source registry and the visualization registry here, so a hand-written request cannot read
// a field, filter or period the source does not offer. The browser never gets a say.

import { z } from "zod";

import {
  AGGREGATIONS,
  COMPARISONS,
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_SCHEMA_VERSION,
  DATE_PRESETS,
  FILTER_OPERATORS,
  GRANULARITIES,
  NUMBER_FORMATS,
  type DashboardWidgetConfig,
} from "./schema";
import { getDashboardSource, sourceDimension, sourceFilter, sourceMetric } from "./sources";
import { getVisualization, visualizationProblem } from "./visualizations";

/** How many rows a single widget may ever pull back, whatever the admin asks for. */
export const MAX_WIDGET_ROWS = 2_000;
/** How many widgets one dashboard may hold. */
export const MAX_WIDGETS = 40;

const filterValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
  z.array(z.number().finite()).max(50),
]);

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Gebruik een datum als JJJJ-MM-DD.");

export const widgetSchema = z.object({
  schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/u, "Een widget-id bevat alleen kleine letters, cijfers en streepjes."),
  ownerId: z.string().max(40).nullable(),
  scope: z.enum(["personal", "shared"]),
  source: z.string().max(60),
  metrics: z.array(z.object({ field: z.string().max(60), aggregation: z.enum(AGGREGATIONS) })).min(1).max(6),
  dimensions: z.array(z.string().max(60)).max(2),
  filters: z.array(z.object({ field: z.string().max(60), operator: z.enum(FILTER_OPERATORS), value: filterValueSchema })).max(10),
  dateRange: z.object({ preset: z.enum(DATE_PRESETS), from: isoDay.optional(), to: isoDay.optional() }),
  granularity: z.enum(GRANULARITIES).optional(),
  comparison: z.enum(COMPARISONS),
  visualization: z.string().max(40),
  display: z.object({
    title: z.string().trim().min(1, "Geef de widget een titel.").max(80),
    subtitle: z.string().max(240).optional(),
    format: z.enum(NUMBER_FORMATS).optional(),
    thresholds: z.array(z.object({ at: z.number().finite(), tone: z.enum(["good", "warn", "bad"]) })).max(5).optional(),
  }),
  layout: z.object({
    x: z.number().int().min(0).max(DASHBOARD_GRID_COLUMNS - 1),
    y: z.number().int().min(0).max(500),
    w: z.number().int().min(1).max(DASHBOARD_GRID_COLUMNS),
    h: z.number().int().min(1).max(8),
  }),
  hidden: z.boolean(),
  custom: z.boolean(),
});

export const preferencesSchema = z.object({
  version: z.literal(DASHBOARD_SCHEMA_VERSION),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS),
});

export type WidgetProblem = { field: string; message: string };

/**
 * Checks one widget against the registries. Returns every problem at once, in Dutch, so the
 * builder can point at the field that is wrong instead of failing with one generic message.
 */
export function validateWidget(widget: DashboardWidgetConfig): WidgetProblem[] {
  const problems: WidgetProblem[] = [];
  const source = getDashboardSource(widget.source);
  if (!source) return [{ field: "source", message: "Deze databron bestaat niet." }];

  for (const metric of widget.metrics) {
    const known = sourceMetric(source, metric.field);
    if (!known) {
      problems.push({ field: "metrics", message: `"${metric.field}" is geen meetwaarde van ${source.label}.` });
      continue;
    }
    if (!known.aggregations.includes(metric.aggregation)) {
      problems.push({ field: "metrics", message: `${known.label} kan niet worden samengevat als "${metric.aggregation}".` });
    }
  }
  const metricFields = widget.metrics.map((metric) => metric.field);
  if (new Set(metricFields).size !== metricFields.length) {
    problems.push({ field: "metrics", message: "Dezelfde meetwaarde staat er twee keer in." });
  }

  for (const dimension of widget.dimensions) {
    if (!sourceDimension(source, dimension)) {
      problems.push({ field: "dimensions", message: `"${dimension}" is geen groepering van ${source.label}.` });
    }
  }
  if (new Set(widget.dimensions).size !== widget.dimensions.length) {
    problems.push({ field: "dimensions", message: "Dezelfde groepering staat er twee keer in." });
  }

  for (const filter of widget.filters) {
    const known = sourceFilter(source, filter.field);
    if (!known) {
      problems.push({ field: "filters", message: `Op "${filter.field}" kan niet worden gefilterd.` });
      continue;
    }
    if (!known.operators.includes(filter.operator)) {
      problems.push({ field: "filters", message: `${known.label} ondersteunt de vergelijking "${filter.operator}" niet.` });
    }
    if (known.values) {
      const allowed = new Set(known.values.map((option) => option.value));
      const chosen = Array.isArray(filter.value) ? filter.value : [filter.value];
      for (const value of chosen) {
        if (!allowed.has(String(value))) {
          problems.push({ field: "filters", message: `"${String(value)}" is geen geldige waarde voor ${known.label}.` });
        }
      }
    }
  }

  if (!source.datePresets.includes(widget.dateRange.preset)) {
    problems.push({ field: "dateRange", message: `${source.label} biedt deze periode niet aan.` });
  }
  if (widget.dateRange.preset === "custom") {
    if (!widget.dateRange.from || !widget.dateRange.to) {
      problems.push({ field: "dateRange", message: "Kies een begin- en einddatum." });
    } else if (widget.dateRange.from > widget.dateRange.to) {
      problems.push({ field: "dateRange", message: "De begindatum ligt na de einddatum." });
    }
  }

  if (widget.granularity && !source.granularities.includes(widget.granularity)) {
    problems.push({ field: "granularity", message: `${source.label} kan niet per ${widget.granularity} worden getoond.` });
  }
  if (!source.comparisons.includes(widget.comparison)) {
    problems.push({ field: "comparison", message: `${source.label} ondersteunt deze vergelijking niet.` });
  }

  const visualization = getVisualization(widget.visualization);
  if (!visualization) {
    problems.push({ field: "visualization", message: "Dit grafiektype bestaat niet." });
  } else {
    const problem = visualizationProblem(visualization, {
      shape: source.shape,
      metricCount: widget.metrics.length,
      dimensionCount: widget.dimensions.length,
      comparison: widget.comparison !== "none",
      allowed: source.onlyVisualizations,
    });
    if (problem) problems.push({ field: "visualization", message: problem });
  }

  return problems;
}

/** Validates a whole dashboard: the shape, every widget and the ids. */
export function validatePreferences(value: unknown):
  | { ok: true; widgets: DashboardWidgetConfig[] }
  | { ok: false; problems: WidgetProblem[] } {
  const parsed = preferencesSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.slice(0, 10).map((issue) => ({
        field: issue.path.join(".") || "preferences",
        message: issue.message,
      })),
    };
  }
  const widgets = parsed.data.widgets as DashboardWidgetConfig[];
  const problems: WidgetProblem[] = [];
  const ids = new Set<string>();
  for (const widget of widgets) {
    if (ids.has(widget.id)) problems.push({ field: "id", message: `Widget-id "${widget.id}" komt twee keer voor.` });
    ids.add(widget.id);
    for (const problem of validateWidget(widget)) {
      problems.push({ field: `${widget.id}.${problem.field}`, message: problem.message });
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, widgets };
}
