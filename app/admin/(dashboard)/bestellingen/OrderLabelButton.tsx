"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

export function OrderLabelButton({
  orderId,
  hasLabel,
}: {
  orderId: string;
  hasLabel: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);

    if (hasLabel) {
      window.open(`/api/admin/orders/${orderId}/postnl-label`, "_blank", "noopener,noreferrer");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/postnl-label`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? `Mislukt (${response.status})`);
        return;
      }

      window.open(`/api/admin/orders/${orderId}/postnl-label`, "_blank", "noopener,noreferrer");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={hasLabel ? "Label printen" : "Label aanmaken en printen"}
        className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-background px-2.5 text-xs font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Bezig…" : hasLabel ? "Print" : "Label"}
      </button>
      {error ? <span className="text-[0.65rem] text-red-600">{error}</span> : null}
    </div>
  );
}
