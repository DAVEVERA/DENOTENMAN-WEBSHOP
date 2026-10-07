"use client";

import { useId, useState } from "react";
import { Download, Table2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { toTableRows, type ChartData } from "@/lib/dashboard/series";

/**
 * The shell every chart sits in. It guarantees three things the drawing alone cannot give:
 * an accessible name, a sentence that says what the chart shows, and the same numbers as a
 * table. Colour is therefore never the only way to read a widget.
 */
export function ChartFrame({
  title,
  summary,
  data,
  /** The row heading above the category column in the table. */
  categoryLabel = "Periode",
  csvName,
  children,
  className,
}: {
  title: string;
  summary: string;
  data: ChartData;
  categoryLabel?: string;
  csvName?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();
  const rows = toTableRows(data);
  const hasRows = rows.length > 0;

  function downloadCsv() {
    const header = [categoryLabel, ...data.series.map((series) => series.label)];
    const lines = rows.map((row) => [row.label, ...row.values.map((cell) => cell.text)]);
    const escape = (value: string) => (/[";\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value);
    const csv = [header, ...lines].map((line) => line.map(escape).join(";")).join("\r\n");
    // BOM and semicolons so Excel with Dutch settings opens it in columns.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(csvName ?? title).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <figure className={cn("m-0", className)} aria-labelledby={summaryId}>
      <div aria-hidden="true">{children}</div>
      {/* The sentence is the chart for anyone who cannot see it, and help text for everyone else. */}
      <figcaption id={summaryId} className="sr-only">{title}. {summary}</figcaption>

      {hasRows ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setShowTable((open) => !open)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-button border border-border bg-surface px-3 font-heading text-xs font-semibold text-text hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
            {showTable ? "Tabel verbergen" : "Toon als tabel"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-button border border-border bg-surface px-3 font-heading text-xs font-semibold text-text hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        </div>
      ) : null}

      <div id={tableId} hidden={!showTable} className="mt-3 overflow-x-auto">
        {hasRows ? (
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">{title} als tabel</caption>
            <thead className="border-b border-border text-xs uppercase tracking-heading text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-bold">{categoryLabel}</th>
                {data.series.map((series) => (
                  <th key={series.key} scope="col" className="py-2 pl-3 text-right font-bold">{series.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 font-normal text-text">{row.label}</th>
                  {row.values.map((cell) => (
                    <td key={cell.key} className="py-2 pl-3 text-right tabular-nums text-text">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </figure>
  );
}

/** What a widget shows while it has nothing to draw. Each state says something different. */
export function ChartPlaceholder({ state, message }: { state: "empty" | "not_measured" | "error" | "loading"; message?: string }) {
  const text = message
    ?? (state === "loading"
      ? "Bezig met laden…"
      : state === "error"
        ? "Laden is mislukt."
        : state === "not_measured"
          ? "Nog niet gemeten."
          : "Geen gegevens in deze periode.");
  return (
    <p
      role={state === "error" ? "alert" : undefined}
      className={cn(
        "flex min-h-24 items-center justify-center rounded-card border border-dashed px-4 py-6 text-center text-body-sm",
        state === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-border bg-background text-muted",
      )}
    >
      {text}
    </p>
  );
}
