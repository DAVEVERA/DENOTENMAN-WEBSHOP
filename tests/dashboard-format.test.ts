import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  amsterdamDay,
  daysBetween,
  describeChange,
  formatValue,
  freshness,
  isStale,
  NO_VALUE,
} from "../lib/dashboard/format";
import {
  buildFunnelSteps,
  coverage,
  normalizeForRadar,
  seriesTotal,
  summarize,
  summarizeFunnel,
  toneForMetric,
  toTableRows,
  type ChartData,
} from "../lib/dashboard/series";

/** Intl separates the euro sign with a non-breaking space; tests should not care which. */
const plain = (value: string) => value.replace(/ /gu, " ");
const rows = (data: Parameters<typeof toTableRows>[0]) =>
  toTableRows(data).map((row) => ({ label: row.label, values: row.values.map((cell) => ({ ...cell, text: plain(cell.text) })) }));

test("a number that was not measured is never shown as zero", () => {
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatValue(value as number | null), NO_VALUE);
  }
  assert.equal(formatValue(0), "0", "a measured zero is still a zero");
});

test("amounts, percentages and durations are written the Dutch way", () => {
  assert.equal(plain(formatValue(1234.5, "euro")), "€ 1.234,50");
  assert.equal(formatValue(0.1234, "percent"), "12,3%");
  assert.equal(formatValue(1234, "integer"), "1.234");
  assert.equal(formatValue(6.5, "duration_hours"), "6,5 uur");
  assert.equal(formatValue(36, "duration_hours"), "1,5 dagen", "above a day people think in days");
});

test("a day is the Amsterdam day, through both clock changes", () => {
  // 23:30 UTC in summer is already the next day in Amsterdam (UTC+2).
  assert.equal(amsterdamDay(new Date("2026-06-30T23:30:00Z")), "2026-07-01");
  // 23:30 UTC in winter is also the next day (UTC+1).
  assert.equal(amsterdamDay(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  // 22:30 UTC in winter is still the same day.
  assert.equal(amsterdamDay(new Date("2026-12-31T22:30:00Z")), "2026-12-31");
});

test("adding days steps over the clock change without losing or gaining a day", () => {
  // Summer time starts 29 March 2026 and ends 25 October 2026.
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
});

test("freshness says how old the numbers are, and stale data is flagged", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(freshness(new Date("2026-10-07T11:59:45Z").toISOString(), now), "zojuist");
  assert.equal(freshness(new Date("2026-10-07T11:30:00Z").toISOString(), now), "30 min geleden");
  assert.equal(freshness(new Date("2026-10-07T09:00:00Z").toISOString(), now), "3 uur geleden");
  assert.equal(freshness(null, now), "nog niet gemeten");
  assert.equal(isStale(new Date("2026-10-07T11:30:00Z").toISOString(), 15, now), true);
  assert.equal(isStale(new Date("2026-10-07T11:55:00Z").toISOString(), 15, now), false);
  assert.equal(isStale(null, 15, now), false, "never measured is not the same as stale");
});

test("growth from nothing is written out instead of shown as an endless rise", () => {
  assert.equal(describeChange(120, 100)?.label, "+20% tegenover vorige periode");
  assert.equal(describeChange(80, 100)?.direction, "down");
  assert.equal(describeChange(100, 100)?.direction, "flat");
  assert.equal(describeChange(5, 0, "euro")?.ratio, null);
  assert.match(plain(describeChange(5, 0, "euro")?.label ?? ""), /van € 0,00 naar € 5,00/u);
  assert.equal(describeChange(5, null), null, "without a comparison there is no change");
});

// ---------- Series ----------

const data: ChartData = {
  categories: ["01-10", "02-10", "03-10"],
  series: [{ key: "netRevenue", label: "Netto omzet", format: "euro", points: [{ label: "01-10", value: 100 }, { label: "02-10", value: null }, { label: "03-10", value: 250, partial: true }] }],
};

test("a chart always has a table with the same numbers", () => {
  assert.deepEqual(rows(data), [
    { label: "01-10", values: [{ key: "netRevenue", text: "€ 100,00" }] },
    { label: "02-10", values: [{ key: "netRevenue", text: NO_VALUE }] },
    { label: "03-10", values: [{ key: "netRevenue", text: "€ 250,00" }] },
  ]);
});

test("the spoken summary names the range, the gaps and the running period", () => {
  const text = plain(summarize(data, { periodLabel: "laatste 3 dagen" }));
  assert.match(text, /Periode: laatste 3 dagen/u);
  assert.match(text, /van € 100,00 tot € 250,00/u);
  assert.match(text, /Totaal € 350,00/u);
  assert.match(text, /1 van de 3 punten is niet gemeten/u);
  assert.match(text, /De laatste periode loopt nog/u);
  assert.equal(summarize({ categories: [], series: [] }), "Nog geen gegevens om te tonen.");
  assert.match(summarize({ categories: ["a"], series: [{ key: "x", label: "Sessies", format: "integer", points: [{ label: "a", value: null }] }] }), /Sessies: niet gemeten/u);
});

test("totals and coverage ignore what was never measured", () => {
  assert.equal(seriesTotal(data.series[0]), 350);
  assert.deepEqual(coverage(data.series[0]), { measured: 2, total: 3 });
  assert.equal(seriesTotal({ ...data.series[0], points: [{ label: "a", value: null }] }), null);
});

test("the same meaning keeps the same colour across widgets", () => {
  assert.equal(toneForMetric("netRevenue"), "revenue");
  assert.equal(toneForMetric("refunds"), "revenue");
  assert.equal(toneForMetric("paidOrders"), "orders");
  assert.equal(toneForMetric("sessions"), "traffic");
  assert.equal(toneForMetric("somethingElse"), "neutral");
});

test("a funnel reports drop-off per step and admits when it counts events", () => {
  const steps = buildFunnelSteps([
    { label: "Productweergave", value: 1000 },
    { label: "In winkelwagen", value: 250 },
    { label: "Checkout", value: 100 },
    { label: "Betaald", value: null },
  ]);
  assert.equal(steps[0].dropOff, null, "the first step has nothing to drop from");
  assert.equal(steps[1].dropOff, 0.75);
  assert.equal(steps[1].shareOfStart, 0.25);
  assert.equal(steps[2].dropOff, 0.6);
  assert.equal(steps[3].shareOfStart, null, "an unmeasured step gets no percentage");

  assert.match(summarizeFunnel(steps, false), /tellen gebeurtenissen, niet unieke bezoekers/u);
  assert.doesNotMatch(summarizeFunnel(steps, true), /indicatie/u);
  assert.match(summarizeFunnel(steps, true), /uitval 75%/u);
});

test("a radar only ever shows scores from 0 to 100", () => {
  const scores = normalizeForRadar([
    { label: "Catalogus", value: 45, best: 50 },
    { label: "Verkeer", value: 120, best: 50 },
    { label: "Koppelingen", value: null, best: 50 },
    { label: "Zonder maximum", value: 10, best: 0 },
  ]);
  assert.equal(scores[0].score, 90);
  assert.equal(scores[1].score, 100, "a score is capped, never off the chart");
  assert.equal(scores[2].score, null);
  assert.equal(scores[3].score, null, "without a maximum there is nothing to normalize against");
  assert.equal(scores[0].raw, 45, "the real value stays available for the table");
});
