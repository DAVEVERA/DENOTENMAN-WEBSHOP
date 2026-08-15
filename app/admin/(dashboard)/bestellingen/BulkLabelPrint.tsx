"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Vandaag", from: () => todayIso(), to: () => todayIso() },
  { label: "Laatste 7 dagen", from: () => daysAgoIso(6), to: () => todayIso() },
  { label: "Laatste 30 dagen", from: () => daysAgoIso(29), to: () => todayIso() },
];

export function BulkLabelPrint() {
  const router = useRouter();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handlePrint() {
    setStatus("busy");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/orders/postnl-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 404) {
          setMessage("Geen bestellingen (betaald/verzonden) in deze periode.");
        } else {
          setMessage(data?.error === "ALL_FAILED" ? "PostNL wees alle labels af." : "Mislukt.");
        }
        setStatus("error");
        return;
      }

      const included = response.headers.get("X-Labels-Included");
      const failedCount = Number(response.headers.get("X-Labels-Failed") ?? "0");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      setStatus("idle");
      setMessage(
        failedCount > 0
          ? `${included} label(s) geprint, ${failedCount} mislukt.`
          : `${included} label(s) klaar om te printen.`
      );
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Mislukt.");
    }
  }

  return (
    <div className="rounded-panel border border-accent bg-[#FFFDF6] p-5">
      <div className="flex items-center gap-2">
        <Printer className="h-5 w-5 text-accent-hover" aria-hidden="true" />
        <h2 className="font-heading text-heading-sm text-text">Verzendlabels printen</h2>
      </div>
      <p className="mt-1 text-body-sm text-muted">
        Print hier de PostNL-verzendlabels voor een periode ineens. Betaalde en verzonden
        bestellingen die nog geen label hebben, krijgen er automatisch een.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="label-from" className="block text-body-sm font-semibold text-text">
            Van
          </label>
          <input
            id="label-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded-button border border-border bg-surface px-3 py-2 text-body-sm"
          />
        </div>
        <div>
          <label htmlFor="label-to" className="block text-body-sm font-semibold text-text">
            Tot en met
          </label>
          <input
            id="label-to"
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
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-accent bg-accent px-5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {status === "busy" ? "Bezig…" : "Print labels"}
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
        <p className={`mt-3 text-body-sm ${status === "error" ? "text-red-600" : "text-text"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
