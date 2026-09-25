"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncBusinessTagsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/marketing/newsletters/sync-business-tags", {
        method: "POST",
      });
      if (!response.ok) {
        setError("Synchroniseren mislukt. Probeer opnieuw.");
        return;
      }
      const body = (await response.json()) as { total: number; tagged: number; skipped: number };
      setMessage(
        `${body.tagged} van ${body.total} zakelijke contacten getagd (${body.skipped} niet gevonden in de audience).`
      );
      router.refresh();
    } catch {
      setError("Synchroniseren mislukt door een netwerkfout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex min-h-9 items-center rounded-button border border-border bg-background px-3 text-xs font-semibold disabled:opacity-60"
      >
        {busy ? "Synchroniseren…" : "Zakelijke tags synchroniseren"}
      </button>
      {message ? <span className="text-xs text-accent-hover">{message}</span> : null}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
