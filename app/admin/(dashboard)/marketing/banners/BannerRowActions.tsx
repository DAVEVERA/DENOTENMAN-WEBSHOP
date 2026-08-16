"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BannerRowActions({
  bannerId,
  isActive,
}: {
  bannerId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleActive() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/banners/${bannerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
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
    if (!window.confirm("Deze banner verwijderen?")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/banners/${bannerId}`, {
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
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={busy}
        className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isActive ? "Deactiveren" : "Activeren"}
      </button>
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
