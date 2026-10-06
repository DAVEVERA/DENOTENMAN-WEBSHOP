"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type Props = {
  orderId: string;
  isPickup: boolean;
  /** Pre-formatted "Naam, 07-10 10:00" lines, empty when not set. */
  processedNote: string | null;
  readyNote: string | null;
  processed: boolean;
  ready: boolean;
};

const segment =
  "inline-flex min-h-11 items-center justify-center px-3 font-heading text-xs font-semibold transition-colors duration-hover-fast disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast";

/** Openstaand / Verwerkt toggle and, for market pickups, a "Staat klaar" toggle. */
export function OrderHandlingControls({ orderId, isPickup, processedNote, readyNote, processed, ready }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(body: { processed?: boolean; readyForPickup?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/handling`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Opslaan mislukt. Probeer opnieuw.");
        return;
      }
      router.refresh();
    } catch {
      setError("Opslaan mislukt door een netwerkfout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[13rem]">
      <div role="group" aria-label="Afhandeling" className="inline-flex overflow-hidden rounded-button border border-border">
        <button
          type="button"
          aria-pressed={!processed}
          disabled={busy || !processed}
          onClick={() => update({ processed: false })}
          className={cn(segment, !processed ? "bg-amber-100 text-amber-900" : "bg-surface text-muted hover:bg-background")}
        >
          Openstaand
        </button>
        <button
          type="button"
          aria-pressed={processed}
          disabled={busy || processed}
          onClick={() => update({ processed: true })}
          className={cn(segment, "border-l border-border", processed ? "bg-emerald-100 text-emerald-900" : "bg-surface text-muted hover:bg-background")}
        >
          Verwerkt
        </button>
      </div>
      {processedNote ? <p className="mt-1 text-xs text-muted">Verwerkt door {processedNote}</p> : null}

      {isPickup ? (
        <div className="mt-2">
          <button
            type="button"
            aria-pressed={ready}
            disabled={busy}
            onClick={() => update({ readyForPickup: !ready })}
            className={cn(segment, "rounded-button border", ready ? "border-sky-300 bg-sky-100 text-sky-900" : "border-border bg-surface text-text hover:bg-background")}
          >
            {ready ? "✓ Staat klaar in de wagen" : "Markeer als staat klaar"}
          </button>
          {readyNote ? <p className="mt-1 text-xs text-muted">Klaargezet door {readyNote}</p> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
