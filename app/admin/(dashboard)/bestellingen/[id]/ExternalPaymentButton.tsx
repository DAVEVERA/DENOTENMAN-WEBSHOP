"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

export function ExternalPaymentButton({ orderId, amountCents }: { orderId: string; amountCents: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    if (!window.confirm(`Bevestig dat ${formatPrice(amountCents, "nl")} buiten de webshop is ontvangen. Dit kan niet ongedaan worden gemaakt.`)) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/external-payment`, { method: "POST" });
      if (!response.ok) throw new Error("De externe betaling kon niet worden geregistreerd.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Opslaan mislukt."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" onClick={() => void confirm()} disabled={busy} className="min-h-11 rounded-button bg-accent px-4 text-body-sm font-bold text-contrast disabled:opacity-50">{busy ? "Registreren…" : "Externe betaling bevestigen"}</button>{error ? <p role="alert" className="mt-2 text-body-sm text-red-700">{error}</p> : null}</div>;
}
