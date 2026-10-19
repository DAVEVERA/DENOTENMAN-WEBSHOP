"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Takes a reading now instead of waiting for the daily job. Without this the
 * rating card stays empty until a Cloud Scheduler job runs for the first time,
 * which looks like a broken widget rather than a missing measurement.
 */
export function MeasureRatingButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/reviews/rating", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFailed(true);
        setMessage(data?.message ?? `Mislukt (${response.status})`);
        return;
      }
      if (data?.status === "skipped") {
        setFailed(true);
        setMessage("Er is nog geen Google place ID ingesteld, of de API-sleutel ontbreekt.");
        return;
      }
      setMessage(
        typeof data?.rating === "number"
          ? `Gemeten: ${data.rating.toFixed(1)} uit ${data.reviewCount} reviews. Herlaad de pagina.`
          : "Gemeten. Herlaad de pagina."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-background px-2.5 text-xs font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Bezig…" : "Meet nu"}
      </button>
      {message ? (
        <span className={failed ? "text-body-sm text-red-600" : "text-body-sm text-muted"}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
