"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscountRowActions({ discountId }: { discountId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Deze kortingscode verwijderen?")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/discounts/${discountId}`, {
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
        onClick={handleDelete}
        disabled={busy}
        className="font-heading text-body-sm font-semibold text-red-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Verwijderen
      </button>
    </div>
  );
}
