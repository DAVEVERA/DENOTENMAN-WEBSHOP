"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryEmailButton({ logId }: { logId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (!window.confirm("Deze e-mail opnieuw naar exact dezelfde ontvanger sturen?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/marketing/email-logboek/${logId}/retry`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setError(body?.message ?? "Opnieuw aanbieden is mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Opnieuw aanbieden is mislukt door een netwerkfout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-button border border-red-300 bg-white px-4 font-heading text-body-sm font-semibold text-red-800 disabled:opacity-50"
      >
        {busy ? "Opnieuw aanbieden…" : "Mislukte mail opnieuw aanbieden"}
      </button>
      {error ? <p role="alert" className="mt-2 text-body-sm text-red-700">{error}</p> : null}
    </div>
  );
}
