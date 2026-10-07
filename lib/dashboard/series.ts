// The one shape every chart consumes, plus the text and table alternatives that go with it.
// Keeping this pure means the accessible summary is tested like any other calculation, and a
// chart component can never show something the summary does not say.

import { formatValue, NO_VALUE, type Change } from "./format";
import type { NumberFormat } from "./schema";

export type SeriesPoint = {
  /** What the point is called on the axis, already formatted for reading. */
  label: string;
  /** null means not measured, which is never the same as 0. */
  value: number | null;
  /** Today is usually incomplete; charts dim it and the summary says so. */
  partial?: boolean;
};

export type Series = {
  key: string;
  label: string;
  format: NumberFormat;
  points: SeriesPoint[];
  /** The same measure over the comparison period, aligned point for point. */
  previous?: SeriesPoint[];
};

export type ChartData = {
  series: Series[];
  /** The shared category or time labels, in the order they are drawn. */
  categories: string[];
};

/** Semantic colours. The same meaning keeps the same colour on every widget. */
export const SERIES_TONES = ["revenue", "orders", "traffic", "neutral", "warn", "bad", "good"] as const;
export type SeriesTone = (typeof SERIES_TONES)[number];

export const TONE_CLASS: Record<SeriesTone, string> = {
  revenue: "bg-[#7B4A2F]",
  orders: "bg-[#DB7B2B]",
  traffic: "bg-accent",
  neutral: "bg-[#8C8375]",
  warn: "bg-[#DB7B2B]",
  bad: "bg-[#B3261E]",
  good: "bg-[#319369]",
};

/** A pattern as well as a colour, so severity never depends on colour alone. */
export const TONE_LABEL: Record<SeriesTone, string> = {
  revenue: "omzet",
  orders: "bestellingen",
  traffic: "verkeer",
  neutral: "overig",
  warn: "let op",
  bad: "probleem",
  good: "goed",
};

export function toneForMetric(field: string): SeriesTone {
  if (/revenue|amount|value|refund|chargeback|margin/iu.test(field)) return "revenue";
  if (/order|purchase|transaction/iu.test(field)) return "orders";
  if (/session|view|user|visitor|engagement|event/iu.test(field)) return "traffic";
  return "neutral";
}

export function seriesMax(series: readonly Series[]): number {
  const values = series.flatMap((item) => [...item.points, ...(item.previous ?? [])].map((point) => point.value ?? 0));
  return Math.max(...values, 0);
}

export function seriesTotal(series: Series): number | null {
  const measured = series.points.filter((point) => point.value !== null);
  if (!measured.length) return null;
  return measured.reduce((sum, point) => sum + (point.value ?? 0), 0);
}

/** How much of a series was actually measured; a mostly empty chart should say so. */
export function coverage(series: Series): { measured: number; total: number } {
  return { measured: series.points.filter((point) => point.value !== null).length, total: series.points.length };
}

export type TableRow = { label: string; values: Array<{ key: string; text: string }> };

/** The table every chart also offers, so the data is readable without seeing the drawing. */
export function toTableRows(data: ChartData): TableRow[] {
  return data.categories.map((category, index) => ({
    label: category,
    values: data.series.map((series) => ({
      key: series.key,
      text: formatValue(series.points[index]?.value ?? null, series.format),
    })),
  }));
}

/**
 * One sentence that says what the chart shows: the range, the extremes and anything missing.
 * Screen readers get this instead of the drawing, and it sits under the chart as help text.
 */
export function summarize(data: ChartData, options: { periodLabel?: string; change?: Change | null } = {}): string {
  if (!data.series.length || !data.categories.length) return "Nog geen gegevens om te tonen.";
  const parts: string[] = [];
  for (const series of data.series) {
    const measured = series.points.filter((point) => point.value !== null);
    if (!measured.length) {
      parts.push(`${series.label}: niet gemeten.`);
      continue;
    }
    const values = measured.map((point) => point.value as number);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    const highestAt = data.categories[series.points.findIndex((point) => point.value === highest)] ?? "";
    const total = values.reduce((sum, value) => sum + value, 0);
    const range = highest === lowest
      ? `steeds ${formatValue(highest, series.format)}`
      : `van ${formatValue(lowest, series.format)} tot ${formatValue(highest, series.format)}, hoogste bij ${highestAt}`;
    parts.push(`${series.label}: ${range}. Totaal ${formatValue(total, series.format)}.`);
    const missing = series.points.length - measured.length;
    if (missing > 0) parts.push(`${missing} van de ${series.points.length} punten is niet gemeten.`);
    if (series.points.some((point) => point.partial)) parts.push("De laatste periode loopt nog.");
  }
  if (options.periodLabel) parts.unshift(`Periode: ${options.periodLabel}.`);
  if (options.change) parts.push(`Verandering: ${options.change.label}.`);
  return parts.join(" ");
}

/** The funnel's drop-off per step, which is the whole point of a funnel. */
export type FunnelStep = {
  label: string;
  value: number | null;
  /** Share of the first step, 0-1, or null when a step was not measured. */
  shareOfStart: number | null;
  /** Share lost against the step before, 0-1. */
  dropOff: number | null;
};

export function buildFunnelSteps(steps: ReadonlyArray<{ label: string; value: number | null }>): FunnelStep[] {
  const start = steps[0]?.value ?? null;
  return steps.map((step, index) => {
    const previous = index === 0 ? null : steps[index - 1].value;
    return {
      label: step.label,
      value: step.value,
      shareOfStart: step.value === null || start === null || start === 0 ? null : step.value / start,
      dropOff: step.value === null || previous === null || previous === 0 ? null : Math.max(0, 1 - step.value / previous),
    };
  });
}

export function summarizeFunnel(steps: readonly FunnelStep[], comparable: boolean): string {
  if (!steps.length) return "Nog geen stappen gemeten.";
  const sentences = steps.map((step, index) => {
    const value = formatValue(step.value, "integer");
    if (index === 0) return `${step.label}: ${value}.`;
    const drop = step.dropOff === null ? NO_VALUE : formatValue(step.dropOff, "percent");
    return `${step.label}: ${value}, uitval ${drop}.`;
  });
  if (!comparable) {
    sentences.push("Let op: de stappen tellen gebeurtenissen, niet unieke bezoekers. Percentages zijn daarom een indicatie.");
  }
  return sentences.join(" ");
}

/** Scales a set of measures to 0-100 so a radar compares like with like. */
export function normalizeForRadar(
  items: ReadonlyArray<{ label: string; value: number | null; best: number }>,
): Array<{ label: string; score: number | null; raw: number | null }> {
  return items.map((item) => ({
    label: item.label,
    raw: item.value,
    score: item.value === null || item.best <= 0 ? null : Math.max(0, Math.min(100, Math.round((item.value / item.best) * 100))),
  }));
}
