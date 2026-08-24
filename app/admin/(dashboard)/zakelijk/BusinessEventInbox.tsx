"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkBusinessEventsReadButton({ unreadCount, eventIds }: { unreadCount: number; eventIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (unreadCount === 0 || eventIds.length === 0) return null;
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/admin/business-events", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventIds }),
            });
            if (!response.ok) throw new Error("MARK_READ_FAILED");
            router.refresh();
          } catch {
            setError("Meldingen bijwerken is niet gelukt. Probeer het opnieuw.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-11 items-center rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60"
      >
        {busy ? "Bezig…" : unreadCount > eventIds.length ? "Getoonde gelezen" : "Alles gelezen"}
      </button>
      {error ? <p role="alert" className="mt-2 text-body-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
