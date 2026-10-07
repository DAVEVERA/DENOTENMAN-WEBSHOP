// How a dashboard number or date is written. Everything the shop reads is Dutch and in
// Europe/Amsterdam, including the day a period starts and ends, so a widget never shows a
// different day than the order list does.

import type { NumberFormat } from "./schema";

export const DASHBOARD_TIME_ZONE = "Europe/Amsterdam";

/** The placeholder for a number that was not measured. Never shown as 0. */
export const NO_VALUE = "—";

const formatters: Record<NumberFormat, Intl.NumberFormat> = {
  integer: new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }),
  decimal: new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
  euro: new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }),
  percent: new Intl.NumberFormat("nl-NL", { style: "percent", maximumFractionDigits: 1 }),
  duration_hours: new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }),
  compact: new Intl.NumberFormat("nl-NL", { notation: "compact", maximumFractionDigits: 1 }),
};

export function formatValue(value: number | null | undefined, format: NumberFormat = "integer"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  if (format === "duration_hours") {
    // Under a day people think in hours; above it, days read better.
    if (value < 24) return `${formatters.duration_hours.format(value)} uur`;
    return `${formatters.duration_hours.format(value / 24)} dagen`;
  }
  return formatters[format].format(value);
}

/** The day a date falls on in Amsterdam, as YYYY-MM-DD. Survives summer and winter time. */
export function amsterdamDay(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/** Adds days to a YYYY-MM-DD day without ever tripping over a clock change. */
export function addDays(day: string, days: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** "07-10" for an axis, "7 oktober 2026" for a sentence. */
export function shortDay(day: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

export function longDay(day: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** When a widget last had fresh data, written the way a person says it. */
export function freshness(generatedAt: string | null, now = new Date()): string {
  if (!generatedAt) return "nog niet gemeten";
  const at = new Date(generatedAt);
  if (!Number.isFinite(at.getTime())) return "nog niet gemeten";
  const minutes = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: DASHBOARD_TIME_ZONE }).format(at);
}

/** Data older than this is shown as stale, so nobody acts on yesterday's numbers. */
export function isStale(generatedAt: string | null, maxAgeMinutes: number, now = new Date()): boolean {
  if (!generatedAt) return false;
  const at = new Date(generatedAt);
  if (!Number.isFinite(at.getTime())) return false;
  return now.getTime() - at.getTime() > maxAgeMinutes * 60_000;
}

export type Change = { direction: "up" | "down" | "flat"; ratio: number | null; label: string };

/**
 * The change against the comparison period. Growth from nothing has no percentage, so it is
 * written out instead of shown as an infinite rise.
 */
export function describeChange(current: number | null, previous: number | null, format: NumberFormat = "integer"): Change | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const difference = current - previous;
  if (previous === 0) {
    if (difference === 0) return { direction: "flat", ratio: 0, label: "gelijk aan vorige periode" };
    return { direction: difference > 0 ? "up" : "down", ratio: null, label: `van ${formatValue(previous, format)} naar ${formatValue(current, format)}` };
  }
  const ratio = difference / Math.abs(previous);
  if (Math.abs(ratio) < 0.005) return { direction: "flat", ratio: 0, label: "gelijk aan vorige periode" };
  const percentage = new Intl.NumberFormat("nl-NL", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(ratio);
  return { direction: ratio > 0 ? "up" : "down", ratio, label: `${percentage} tegenover vorige periode` };
}
