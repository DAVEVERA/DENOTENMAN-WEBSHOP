"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatValue, NO_VALUE, type Change } from "@/lib/dashboard/format";
import {
  buildFunnelSteps,
  seriesMax,
  summarize,
  summarizeFunnel,
  toneForMetric,
  TONE_CLASS,
  type ChartData,
  type Series,
} from "@/lib/dashboard/series";
import type { NumberFormat } from "@/lib/dashboard/schema";
import { ChartFrame, ChartPlaceholder } from "./ChartFrame";

/** A bar never disappears completely, so a measured near-zero still reads as present. */
const MIN_BAR = 2;

function share(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.max(MIN_BAR, Math.min(100, (value / max) * 100));
}

// ---------- Kerncijfer ----------

export function KpiChart({
  value,
  format = "integer",
  change,
  hero,
  trend,
}: {
  value: number | null;
  format?: NumberFormat;
  change?: Change | null;
  hero?: boolean;
  /** An optional trend behind the number; it is decoration, the number is the message. */
  trend?: Series;
}) {
  const Icon = change?.direction === "up" ? ArrowUpRight : change?.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <div>
      <p className={cn("font-heading font-bold tracking-tight tabular-nums", hero ? "text-5xl sm:text-6xl" : "text-4xl")}>
        {formatValue(value, format)}
      </p>
      {change ? (
        <p className={cn("mt-2 inline-flex items-center gap-1 text-body-sm font-semibold", change.direction === "up" ? "text-[#1F6B4C]" : change.direction === "down" ? "text-[#8C2F26]" : "text-muted")}>
          {/* The arrow and the words carry the direction; the colour only reinforces it. */}
          <Icon className="h-4 w-4" aria-hidden="true" />
          {change.label}
        </p>
      ) : null}
      {trend ? <Sparkline series={trend} /> : null}
    </div>
  );
}

export function Sparkline({ series }: { series: Series }) {
  const points = series.points.slice(-14);
  const max = Math.max(...points.map((point) => point.value ?? 0), 1);
  if (!points.length) return null;
  return (
    <div className="mt-4 flex h-16 items-end gap-1" aria-hidden="true">
      {points.map((point, index) => (
        <span
          key={`${point.label}-${index}`}
          className={cn("min-h-1 flex-1 rounded-t", TONE_CLASS[toneForMetric(series.key)], point.partial && "opacity-50")}
          style={{ height: `${share(point.value, max)}%` }}
        />
      ))}
    </div>
  );
}

// ---------- Tijdreeks ----------

/**
 * One or more measures over time. "area" fills the shape under the line; with many points a
 * line reads better, which is why the registry defaults to it.
 */
export function TimeSeriesChart({ data, title, variant = "line", periodLabel }: { data: ChartData; title: string; variant?: "line" | "area" | "bar"; periodLabel?: string }) {
  const max = seriesMax(data.series);
  if (!data.categories.length) return <ChartPlaceholder state="empty" />;
  const width = Math.max(data.categories.length * 28, 320);

  return (
    <ChartFrame title={title} summary={summarize(data, { periodLabel })} data={data} categoryLabel="Periode">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-full" style={{ minWidth: `${width}px` }}>
          <div className="flex h-48 items-end gap-1 border-b border-border px-0.5 sm:h-56">
            {data.categories.map((category, index) => (
              <div key={`${category}-${index}`} className="flex h-full min-w-2 flex-1 flex-col justify-end gap-0.5">
                {data.series.map((series) => {
                  const point = series.points[index];
                  const tone = TONE_CLASS[toneForMetric(series.key)];
                  return (
                    <div
                      key={series.key}
                      title={`${category} · ${series.label}: ${formatValue(point?.value ?? null, series.format)}`}
                      className={cn(
                        "min-h-0.5 rounded-t",
                        tone,
                        variant === "area" && "opacity-70",
                        point?.partial && "opacity-50",
                        point?.value === null && "bg-border",
                      )}
                      style={{ height: `${share(point?.value ?? null, max)}%` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{data.categories[0]}</span>
            <span>{data.categories.at(-1)}</span>
          </div>
        </div>
      </div>
      <Legend series={data.series} />
    </ChartFrame>
  );
}

// ---------- Categorie ----------

export function BarChart({ data, title, direction = "horizontal", categoryLabel = "Categorie" }: { data: ChartData; title: string; direction?: "horizontal" | "vertical"; categoryLabel?: string }) {
  const max = seriesMax(data.series);
  if (!data.categories.length) return <ChartPlaceholder state="empty" />;

  if (direction === "vertical") {
    return (
      <ChartFrame title={title} summary={summarize(data)} data={data} categoryLabel={categoryLabel}>
        <div className="overflow-x-auto pb-1">
          <div className="flex h-48 items-end gap-2 border-b border-border px-0.5" style={{ minWidth: `${Math.max(data.categories.length * 48, 280)}px` }}>
            {data.categories.map((category, index) => (
              <div key={category} className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-bold tabular-nums text-text">{formatValue(data.series[0]?.points[index]?.value ?? null, data.series[0]?.format)}</span>
                <div
                  className={cn("w-full max-w-14 rounded-t", TONE_CLASS[toneForMetric(data.series[0]?.key ?? "")])}
                  style={{ height: `${share(data.series[0]?.points[index]?.value ?? null, max)}%` }}
                />
                <span className="w-full truncate text-center text-[0.68rem] text-muted" title={category}>{category}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame title={title} summary={summarize(data)} data={data} categoryLabel={categoryLabel}>
      <ul className="grid gap-2">
        {data.categories.map((category, index) => {
          const point = data.series[0]?.points[index];
          return (
            <li key={category} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-body-sm text-text" title={category}>{category}</span>
                <strong className="shrink-0 tabular-nums text-body-sm">{formatValue(point?.value ?? null, data.series[0]?.format)}</strong>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-background">
                <div
                  className={cn("h-full rounded-full", TONE_CLASS[toneForMetric(data.series[0]?.key ?? "")], point?.value === null && "bg-border")}
                  style={{ width: `${share(point?.value ?? null, max)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

// ---------- Funnel ----------

export function FunnelChart({
  steps,
  title,
  comparable,
}: {
  steps: ReadonlyArray<{ label: string; value: number | null }>;
  title: string;
  /** False when the steps count events rather than unique visitors; the widget then says so. */
  comparable: boolean;
}) {
  const built = buildFunnelSteps(steps);
  const data: ChartData = {
    categories: built.map((step) => step.label),
    series: [{ key: "reach", label: "Bereik", format: "integer", points: built.map((step) => ({ label: step.label, value: step.value })) }],
  };
  const max = Math.max(...built.map((step) => step.value ?? 0), 1);

  return (
    <ChartFrame title={title} summary={summarizeFunnel(built, comparable)} data={data} categoryLabel="Stap">
      <ol className="grid gap-3">
        {built.map((step, index) => (
          <li key={step.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-body-sm font-bold text-text">{index + 1}. {step.label}</span>
              <strong className="tabular-nums">{formatValue(step.value, "integer")}</strong>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-background">
                <div className={cn("h-full rounded-full", TONE_CLASS[index === built.length - 1 ? "good" : "orders"])} style={{ width: `${share(step.value, max)}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right text-xs font-semibold text-muted">
                {index === 0 ? "start" : step.dropOff === null ? NO_VALUE : `−${formatValue(step.dropOff, "percent")}`}
              </span>
            </div>
          </li>
        ))}
      </ol>
      {!comparable ? (
        <p className="mt-3 rounded-card border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Deze stappen tellen gebeurtenissen, niet unieke bezoekers. Dezelfde bezoeker kan meerdere keren meetellen, dus lees de percentages als richting, niet als exacte conversie.
        </p>
      ) : null}
    </ChartFrame>
  );
}

// ---------- Legenda ----------

function Legend({ series }: { series: readonly Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", TONE_CLASS[toneForMetric(item.key)])} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
