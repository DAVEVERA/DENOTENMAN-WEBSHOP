"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuoteStatus } from "@prisma/client";

const NEXT_ACTIONS: Record<QuoteStatus, { status: QuoteStatus; label: string; confirm: string }[]> = {
  DRAFT: [{ status: "SENT", label: "Verstuur offerte", confirm: "Deze offerte naar de klant versturen?" }],
  SENT: [
    { status: "ACCEPTED", label: "Markeer als geaccepteerd", confirm: "Deze offerte markeren als geaccepteerd?" },
    { status: "DECLINED", label: "Markeer als afgewezen", confirm: "Deze offerte markeren als afgewezen?" },
  ],
  ACCEPTED: [],
  DECLINED: [],
};

export function QuoteRowActions({
  businessAccountId,
  quoteId,
  status,
}: {
  businessAccountId: string;
  quoteId: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [busyStatus, setBusyStatus] = useState<QuoteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = NEXT_ACTIONS[status];
  if (actions.length === 0) return <span className="text-muted">—</span>;

  async function handleTransition(nextStatus: QuoteStatus, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;

    setBusyStatus(nextStatus);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/business-accounts/${businessAccountId}/quotes/${quoteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!response.ok) {
        setError("Bijwerken mislukt.");
        setBusyStatus(null);
        return;
      }

      router.refresh();
    } catch {
      setError("Bijwerken mislukt door een netwerkfout.");
      setBusyStatus(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
      {actions.map((action) => (
        <button
          key={action.status}
          type="button"
          onClick={() => handleTransition(action.status, action.confirm)}
          disabled={busyStatus !== null}
          className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyStatus === action.status ? "Bezig…" : action.label}
        </button>
      ))}
    </div>
  );
}
