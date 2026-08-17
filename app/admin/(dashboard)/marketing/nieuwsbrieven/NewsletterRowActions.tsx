"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewsletterRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraft = status === "save";

  async function handleDelete() {
    if (!window.confirm("Dit Mailchimp-concept definitief verwijderen?")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/newsletters/${campaignId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Verwijderen mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Verwijderen mislukt door een netwerkfout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
      <Link
        href={`/admin/marketing/nieuwsbrieven/${campaignId}`}
        className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
      >
        {isDraft ? "Bewerken" : "Bekijken"}
      </Link>
      {isDraft ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="font-heading text-body-sm font-semibold text-red-700 underline underline-offset-4 disabled:opacity-60"
        >
          Verwijderen
        </button>
      ) : null}
    </div>
  );
}
