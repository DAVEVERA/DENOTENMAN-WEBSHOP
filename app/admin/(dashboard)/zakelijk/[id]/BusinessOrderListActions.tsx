"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessOrderListActions({ accountId, orderListId, status, deliveryStatus, updatedAt }: { accountId: string; orderListId: string; status: string; deliveryStatus: string; updatedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staleSending = deliveryStatus === "SENDING" && Date.now() - new Date(updatedAt).getTime() >= 5 * 60 * 1000;
  const canSend = status === "DRAFT" || status === "CHANGES_REQUESTED" || (status === "SENT" && (deliveryStatus === "FAILED" || staleSending));
  const canResolve = deliveryStatus === "UNKNOWN";
  const canCancel = status !== "APPROVED" && status !== "CANCELLED" && !canResolve && deliveryStatus !== "SENDING";
  if (!canSend && !canCancel && !canResolve) return <p className="mt-3 text-body-sm font-semibold text-muted">Verzending wordt verwerkt. Ververs na vijf minuten als de status niet verandert.</p>;

  async function act(action: "SEND" | "CANCEL" | "CONFIRM_DELIVERED" | "CONFIRM_FAILED") {
    const label = action === "SEND" ? "versturen" : action === "CANCEL" ? "annuleren" : action === "CONFIRM_DELIVERED" ? "als verzonden bevestigen" : "vrijgeven voor opnieuw verzenden";
    if (!window.confirm(`Bestellijst ${label}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${accountId}/order-lists/${orderListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as { warning?: string; error?: string } | null;
      if (!response.ok) {
        setError(data?.error === "DELIVERY_STATUS_UNKNOWN" ? "Controleer eerst in het e-maillog of de klantmail is verstuurd." : "Actie is mislukt. Ververs de pagina en probeer opnieuw.");
        router.refresh();
        return;
      }
      if (data?.warning === "ORDER_LIST_EMAIL_FAILED") setError("De lijst staat klaar, maar de klantmail is niet verzonden. Verstuur de lijst opnieuw zodra de mailprovider beschikbaar is.");
      router.refresh();
    } catch {
      setError("De verbinding viel weg. De actie is niet bevestigd; ververs de pagina voordat je opnieuw probeert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canSend ? <button type="button" disabled={busy} onClick={() => act("SEND")} className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast disabled:opacity-60">{busy ? "Bezig…" : deliveryStatus === "SENDING" ? "Vastgelopen verzending herstellen" : status === "CHANGES_REQUESTED" || deliveryStatus === "FAILED" ? "Opnieuw naar klant sturen" : "Naar klant sturen"}</button> : null}
      {canResolve ? <button type="button" disabled={busy} onClick={() => act("CONFIRM_DELIVERED")} className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast disabled:opacity-60">Mail is verzonden</button> : null}
      {canResolve ? <button type="button" disabled={busy} onClick={() => act("CONFIRM_FAILED")} className="inline-flex min-h-11 items-center rounded-button border border-border px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60">Veilig opnieuw verzenden</button> : null}
      {canCancel ? <button type="button" disabled={busy} onClick={() => act("CANCEL")} className="inline-flex min-h-11 items-center rounded-button border border-border px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60">Annuleren</button> : null}
      {error ? <p role="alert" className="w-full text-body-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
