"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Dag", from: () => todayIso(), to: () => todayIso() },
  { label: "3 dagen", from: () => daysAgoIso(2), to: () => todayIso() },
  { label: "Week", from: () => daysAgoIso(6), to: () => todayIso() },
];

export function MarketManifestPrint() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handlePrint() {
    setStatus("busy");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/orders/market-manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setMessage("Geen afhaalbestellingen (betaald, nog niet afgehaald) in deze periode.");
        } else {
          setMessage("Mislukt.");
        }
        setStatus("error");
        return;
      }

      const orderCount = response.headers.get("X-Manifest-Orders");
      const groupCount = response.headers.get("X-Manifest-Groups");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      setStatus("idle");
      setMessage(`${orderCount} bestelling(en) in ${groupCount} markt(en) klaar om te printen.`);
    } catch {
      setStatus("error");
      setMessage("Mislukt.");
    }
  }

  return (
    <div className="rounded-panel border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-accent-hover" aria-hidden="true" />
        <h2 className="font-heading text-heading-sm text-text">Afhaalmanifest markt printen</h2>
      </div>
      <p className="mt-1 text-body-sm text-muted">
        Print een uitdeellijst per markt voor betaalde afhaalbestellingen — naam, telefoon en artikelen, gegroepeerd
        per marktlocatie.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="manifest-from" className="block text-body-sm font-semibold text-text">
            Van
          </label>
          <input
            id="manifest-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-button border border-border bg-surface px-3 py-2 text-body-sm"
          />
        </div>
        <div>
          <label htmlFor="manifest-to" className="block text-body-sm font-semibold text-text">
            Tot en met
          </label>
          <input
            id="manifest-to"
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
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          {status === "busy" ? "Bezig…" : "Print afhaalmanifest"}
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
