"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT_STATUS: Record<string, { value: "DRAFT" | "SCHEDULED" | "SENT"; label: string } | null> = {
  DRAFT: { value: "SCHEDULED", label: "Inplannen" },
  SCHEDULED: { value: "SENT", label: "Markeer als verzonden" },
  SENT: null,
};

export function NewsletterRowActions({
  newsletterId,
  status,
  scheduledAt,
}: {
  newsletterId: string;
  status: string;
  scheduledAt: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = NEXT_STATUS[status] ?? null;

  async function handleAdvance() {
    if (!nextStatus) return;
    if (nextStatus.value === "SCHEDULED" && !scheduledAt) {
      setError("Stel eerst een verzenddatum in.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/newsletters/${newsletterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus.value }),
      });
      if (!response.ok) {
        setError("Bijwerken mislukt.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Bijwerken mislukt door een netwerkfout.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Deze nieuwsbrief verwijderen?")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/newsletters/${newsletterId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Verwijderen mislukt.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Verwijderen mislukt door een netwerkfout.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
      {nextStatus ? (
        <button
          type="button"
          onClick={handleAdvance}
          disabled={busy}
          className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextStatus.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="font-heading text-body-sm font-semibold text-red-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Verwijderen
      </button>
    </div>
  );
}
