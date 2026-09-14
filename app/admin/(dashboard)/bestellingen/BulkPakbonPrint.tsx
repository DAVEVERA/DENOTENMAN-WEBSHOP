"use client";

import { useState } from "react";
import { Package } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Most recently completed (or current) Saturday–Sunday. */
function lastWeekendRange(): { from: string; to: string } {
  const today = new Date();
  const daysSinceSaturday = (today.getDay() + 1) % 7; // Sun=0 -> 1, Mon=1 -> 2, ..., Sat=6 -> 0
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysSinceSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { from: saturday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

const PRESETS = [
  { label: "Dag", from: () => todayIso(), to: () => todayIso() },
  { label: "2 dagen", from: () => daysAgoIso(1), to: () => todayIso() },
  { label: "3 dagen", from: () => daysAgoIso(2), to: () => todayIso() },
  { label: "Weekend", from: () => lastWeekendRange().from, to: () => lastWeekendRange().to },
  { label: "Week", from: () => daysAgoIso(6), to: () => todayIso() },
];

export function BulkPakbonPrint() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handlePrint() {
    setStatus("busy");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/orders/pakbon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 404) {
          setMessage("Geen bestellingen (betaald/verzonden) in deze periode.");
        } else if (response.status === 413) {
          setMessage(data?.message ?? "Te veel bestellingen voor één batch.");
        } else {
          setMessage("Mislukt.");
        }
        setStatus("error");
        return;
      }

      const included = response.headers.get("X-Pakbonnen-Included");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      setStatus("idle");
      setMessage(`${included} pakbon(nen) klaar om te printen.`);
    } catch {
      setStatus("error");
      setMessage("Mislukt.");
    }
  }

  return (
    <div className="rounded-panel border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-accent-hover" aria-hidden="true" />
        <h2 className="font-heading text-heading-sm text-text">Pakbonnen printen</h2>
      </div>
      <p className="mt-1 text-body-sm text-muted">
        Print hier de pakbonnen voor een periode ineens — voor betaalde en verzonden bestellingen.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pakbon-from" className="block text-body-sm font-semibold text-text">
            Van
          </label>
          <input
            id="pakbon-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-button border border-border bg-surface px-3 py-2 text-body-sm"
          />
        </div>
        <div>
          <label htmlFor="pakbon-to" className="block text-body-sm font-semibold text-text">
            Tot en met
          </label>
          <input
            id="pakbon-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded-button border border-border bg-surface px-3 py-2 text-body-sm"
          />
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={status === "busy"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-border bg-background px-5 font-heading text-body-md font-semibold text-text shadow-button transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Package className="h-4 w-4" aria-hidden="true" />
          {status === "busy" ? "Bezig…" : "Print pakbonnen"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setFrom(preset.from());
              setTo(preset.to());
            }}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className={`mt-3 text-body-sm ${status === "error" ? "text-red-600" : "text-text"}`}>{message}</p>
      ) : null}
    </div>
  );
}
