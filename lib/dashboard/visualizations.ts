// Which chart may show which data. A source declares its shape (lib/dashboard/sources.ts) and
// a widget declares how many measures and groupings it uses; this registry decides which
// visualizations make sense for that combination. The builder only offers those, and the
// server refuses the rest, so a pie chart of a time series can never be saved.

import type { SourceShape } from "./sources";

export type VisualizationId =
  | "kpi"
  | "sparkline"
  | "line"
  | "area"
  | "area_stacked"
  | "bar_vertical"
  | "bar_horizontal"
  | "bar_grouped"
  | "bar_stacked"
  | "donut"
  | "funnel"
  | "heatmap"
  | "waterfall"
  | "scatter"
  | "bullet"
  | "radar"
  | "table";

export type Visualization = {
  id: VisualizationId;
  label: string;
  /** Plain Dutch, shown next to the choice in the builder. */
  hint: string;
  shapes: readonly SourceShape[];
  metrics: { min: number; max: number };
  dimensions: { min: number; max: number };
  /** Part-of-whole charts lie once there are too many slices. */
  maxCategories?: number;
  supportsComparison: boolean;
};

export const VISUALIZATIONS: readonly Visualization[] = [
  { id: "kpi", label: "Kerncijfer", hint: "Eén getal, met vergelijking en trendpijl.", shapes: ["scalar", "timeSeries", "categorical", "table", "goal"], metrics: { min: 1, max: 1 }, dimensions: { min: 0, max: 1 }, supportsComparison: true },
  { id: "sparkline", label: "Minigrafiek", hint: "Compacte trendlijn zonder assen, naast een getal.", shapes: ["timeSeries"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "line", label: "Lijn", hint: "Verloop over tijd. De beste keuze bij veel datapunten.", shapes: ["timeSeries"], metrics: { min: 1, max: 4 }, dimensions: { min: 1, max: 1 }, supportsComparison: true },
  { id: "area", label: "Vlak", hint: "Verloop over tijd met nadruk op het volume.", shapes: ["timeSeries"], metrics: { min: 1, max: 3 }, dimensions: { min: 1, max: 1 }, supportsComparison: true },
  { id: "area_stacked", label: "Gestapeld vlak", hint: "Opbouw van een totaal over tijd.", shapes: ["timeSeries"], metrics: { min: 2, max: 5 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "bar_vertical", label: "Staaf verticaal", hint: "Vergelijking tussen categorieën of korte reeksen.", shapes: ["timeSeries", "categorical"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, supportsComparison: true },
  { id: "bar_horizontal", label: "Staaf horizontaal", hint: "Vergelijking met lange namen, of een ranglijst.", shapes: ["categorical", "steps", "table"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, supportsComparison: true },
  { id: "bar_grouped", label: "Gegroepeerde staaf", hint: "Twee of meer maten naast elkaar per categorie.", shapes: ["categorical", "timeSeries"], metrics: { min: 2, max: 4 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "bar_stacked", label: "Gestapelde staaf", hint: "Opbouw van een totaal per categorie.", shapes: ["categorical", "timeSeries"], metrics: { min: 2, max: 5 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "donut", label: "Donut", hint: "Verdeling van één geheel. Alleen bij weinig delen; de staart komt onder Overig.", shapes: ["categorical"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, maxCategories: 5, supportsComparison: false },
  { id: "funnel", label: "Funnel", hint: "Opeenvolgende stappen met uitval per stap.", shapes: ["steps"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, supportsComparison: true },
  { id: "heatmap", label: "Heatmap", hint: "Twee groeperingen tegen elkaar, bijvoorbeeld weekdag en uur.", shapes: ["matrix"], metrics: { min: 1, max: 1 }, dimensions: { min: 2, max: 2 }, supportsComparison: false },
  { id: "waterfall", label: "Waterval", hint: "Van begin naar eind via plussen en minnen, bijvoorbeeld bruto naar netto.", shapes: ["categorical", "steps"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "scatter", label: "Spreiding", hint: "Verband tussen twee maten, bijvoorbeeld weergaven tegen omzet.", shapes: ["categorical", "table"], metrics: { min: 2, max: 3 }, dimensions: { min: 1, max: 1 }, supportsComparison: false },
  { id: "bullet", label: "Voortgang", hint: "Doel tegen werkelijkheid, met de benodigde dagkoers.", shapes: ["goal", "scalar"], metrics: { min: 1, max: 2 }, dimensions: { min: 0, max: 1 }, supportsComparison: true },
  { id: "radar", label: "Radar", hint: "Profiel van drie tot acht scores van 0 tot 100.", shapes: ["normalized"], metrics: { min: 1, max: 1 }, dimensions: { min: 1, max: 1 }, maxCategories: 8, supportsComparison: false },
  { id: "table", label: "Tabel", hint: "Alle waarden als lijst, sorteerbaar en met doorklik.", shapes: ["scalar", "timeSeries", "categorical", "steps", "table", "matrix", "goal", "normalized"], metrics: { min: 1, max: 6 }, dimensions: { min: 0, max: 2 }, supportsComparison: true },
];

const BY_ID = new Map(VISUALIZATIONS.map((visualization) => [visualization.id, visualization]));

export function getVisualization(id: string): Visualization | undefined {
  return BY_ID.get(id as VisualizationId);
}

export type VisualizationRequest = {
  shape: SourceShape;
  metricCount: number;
  dimensionCount: number;
  /** How many distinct values the grouping has, when that is already known. */
  categoryCount?: number;
  comparison?: boolean;
  /** A source may narrow the list further than its shape would. */
  allowed?: readonly string[];
};

/** Why this visualization does not fit, in plain Dutch, or null when it does. */
export function visualizationProblem(
  visualization: Visualization,
  request: VisualizationRequest,
): string | null {
  if (!visualization.shapes.includes(request.shape)) return "Dit grafiektype past niet bij deze databron.";
  if (request.allowed && !request.allowed.includes(visualization.id)) return "Deze databron biedt dit grafiektype niet aan.";
  if (request.metricCount < visualization.metrics.min) {
    return visualization.metrics.min === 1 ? "Kies ten minste één meetwaarde." : `Kies ten minste ${visualization.metrics.min} meetwaarden.`;
  }
  if (request.metricCount > visualization.metrics.max) {
    return visualization.metrics.max === 1 ? "Dit grafiektype toont één meetwaarde." : `Dit grafiektype toont maximaal ${visualization.metrics.max} meetwaarden.`;
  }
  if (request.dimensionCount < visualization.dimensions.min) return "Kies een groepering om dit grafiektype te gebruiken.";
  if (request.dimensionCount > visualization.dimensions.max) return `Dit grafiektype gebruikt maximaal ${visualization.dimensions.max} groepering${visualization.dimensions.max === 1 ? "" : "en"}.`;
  if (visualization.maxCategories && request.categoryCount !== undefined && request.categoryCount > visualization.maxCategories) {
    return `Dit grafiektype blijft leesbaar tot ${visualization.maxCategories} delen; daarboven wordt de staart samengevat onder Overig.`;
  }
  if (request.comparison && !visualization.supportsComparison) return "Dit grafiektype toont geen vergelijking met een vorige periode.";
  return null;
}

export function compatibleVisualizations(request: VisualizationRequest): Visualization[] {
  return VISUALIZATIONS.filter((visualization) => visualizationProblem(visualization, request) === null);
}

/**
 * The chart to start with. A long time series reads better as a line than as bars, and a
 * part-of-whole with many slices should not default to a donut.
 */
export function defaultVisualization(request: VisualizationRequest & { preferred?: string }): VisualizationId {
  const fits = compatibleVisualizations(request);
  const preferred = request.preferred ? fits.find((visualization) => visualization.id === request.preferred) : undefined;
  if (preferred) return preferred.id;
  const order: VisualizationId[] = request.shape === "timeSeries"
    ? ["line", "area", "bar_vertical", "kpi", "table"]
    : request.shape === "steps"
      ? ["funnel", "bar_horizontal", "table"]
      : request.shape === "categorical"
        ? ["bar_horizontal", "bar_vertical", "table"]
        : ["kpi", "table"];
  return order.find((id) => fits.some((visualization) => visualization.id === id)) ?? fits[0]?.id ?? "table";
}

/**
 * Keeps a part-of-whole chart honest: the biggest slices stay, the rest is summed into "Overig".
 * Returns the slices unchanged when they already fit.
 */
export function groupLongTail<T extends { label: string; value: number }>(
  slices: readonly T[],
  maxSlices: number,
): Array<{ label: string; value: number; isRest?: boolean }> {
  if (slices.length <= maxSlices) return slices.map((slice) => ({ label: slice.label, value: slice.value }));
  const sorted = [...slices].sort((left, right) => right.value - left.value);
  const kept = sorted.slice(0, maxSlices - 1).map((slice) => ({ label: slice.label, value: slice.value }));
  const rest = sorted.slice(maxSlices - 1).reduce((sum, slice) => sum + slice.value, 0);
  return [...kept, { label: "Overig", value: rest, isRest: true }];
}
