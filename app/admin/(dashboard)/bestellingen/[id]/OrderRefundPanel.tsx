"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import {
  calculateOrderRefund,
  isCommittedRefundStatus,
  type ExistingRefundReservation,
} from "@/lib/order-refund-calculation";

type RefundableItem = {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
};

type RefundHistoryItem = ExistingRefundReservation & {
  id: string;
  mollieRefundId: string | null;
  reason: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  CREATING: "Wordt aangemaakt",
  QUEUED: "In wachtrij bij Mollie",
  PENDING: "In behandeling",
  PROCESSING: "Wordt verwerkt",
  REFUNDED: "Terugbetaald",
  FAILED: "Mislukt",
  CANCELED: "Geannuleerd",
};

function refundErrorMessage(code: string | undefined): string {
  switch (code) {
    case "MOLLIE_REFUND_UNCERTAIN_RETRY_SAME_REQUEST":
      return "De Mollie-uitkomst is nog onzeker. Klik opnieuw met dezelfde selectie; dezelfde aanvraag-ID voorkomt een dubbele terugbetaling.";
    case "REFUND_QUANTITY_EXCEEDS_REMAINING":
      return "Een geselecteerd aantal is intussen al geannuleerd. Vernieuw de pagina.";
    case "SHIPPING_ALREADY_REFUNDED":
      return "De verzendkosten zijn al eerder terugbetaald.";
    case "MOLLIE_REFUND_AMOUNT_UNAVAILABLE":
      return "Mollie staat dit terug te betalen bedrag niet toe. Controleer de betaling in Mollie.";
    case "ORDER_NOT_REFUNDABLE":
    case "MOLLIE_PAYMENT_NOT_PAID":
      return "Deze bestelling is niet (meer) terugbetaalbaar.";
    case "CONCURRENT_REFUND_CONFLICT":
      return "Er wordt tegelijk een andere terugbetaling verwerkt. Vernieuw de pagina.";
    case "REFUND_REQUEST_CLOSED":
      return "Deze terugbetalingsaanvraag is gesloten door Mollie. Vernieuw de pagina en maak alleen na controle een nieuwe aanvraag.";
    case "UNAUTHORIZED":
      return "De adminsessie is verlopen. Log opnieuw in.";
    default:
      return "De deelterugbetaling is niet gelukt. Probeer het opnieuw met dezelfde selectie.";
  }
}

export function OrderRefundPanel({
  orderId,
  subtotalCents,
  discountCents,
  shippingCents,
  totalCents,
  items,
  refunds,
  canRefund,
}: {
  orderId: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  items: RefundableItem[];
  refunds: RefundHistoryItem[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [includeShipping, setIncludeShipping] = useState(false);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canceledByItem = useMemo(() => {
    const result = new Map<string, number>();
    for (const refund of refunds) {
      if (!isCommittedRefundStatus(refund.status)) continue;
      for (const item of refund.items) {
        result.set(item.orderItemId, (result.get(item.orderItemId) ?? 0) + item.quantity);
      }
    }
    return result;
  }, [refunds]);
  const shippingAlreadyReserved = refunds.some(
    (refund) => isCommittedRefundStatus(refund.status) && refund.includesShipping
  );
  const selections = useMemo(
    () => items
      .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id] ?? 0 }))
      .filter((item) => item.quantity > 0),
    [items, quantities]
  );
  const calculation = useMemo(() => {
    try {
      return calculateOrderRefund({
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        items,
        selections,
        existingRefunds: refunds,
        includeShipping,
      });
    } catch {
      return null;
    }
  }, [discountCents, includeShipping, items, refunds, selections, shippingCents, subtotalCents, totalCents]);

  async function submitRefund() {
    if (!calculation || state === "saving") return;
    const confirmed = window.confirm(
      `Je annuleert ${selections.reduce((sum, item) => sum + item.quantity, 0)} artikel(en) en betaalt ${formatPrice(calculation.amountCents, "nl")} terug via Mollie. Doorgaan?`
    );
    if (!confirmed) return;

    const stableRequestId = requestId ?? crypto.randomUUID();
    setRequestId(stableRequestId);
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: stableRequestId,
          reason: reason.trim() || null,
          includeShipping,
          items: selections,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        refund?: { amountCents: number; status: string };
      } | null;
      if (!response.ok || !body?.refund) {
        setState("error");
        setMessage(refundErrorMessage(body?.error));
        return;
      }

      setState("saved");
      setMessage(
        `${formatPrice(body.refund.amountCents, "nl")} is bij Mollie aangeboden voor terugbetaling.`
      );
      setQuantities({});
      setIncludeShipping(false);
      setReason("");
      setRequestId(null);
      router.refresh();
    } catch {
      setState("error");
      setMessage(refundErrorMessage("MOLLIE_REFUND_UNCERTAIN_RETRY_SAME_REQUEST"));
    }
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <div>
        <h2 className="font-heading text-heading-sm text-text">Deelannulering en terugbetaling</h2>
        <p className="mt-1 max-w-2xl text-body-sm text-muted">
          Kies per orderregel hoeveel stuks worden geannuleerd. Het bedrag wordt server-side berekend en idempotent via Mollie uitgevoerd.
        </p>
      </div>

      {canRefund ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3">
            {items.map((item) => {
              const remaining = Math.max(0, item.quantity - (canceledByItem.get(item.id) ?? 0));
              return (
                <div key={item.id} className="grid gap-3 rounded-button border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{item.productName}</p>
                    <p className="text-body-sm text-muted">
                      {item.variantLabel} · {formatPrice(item.unitPriceCents, "nl")} per stuk · {remaining} beschikbaar
                    </p>
                  </div>
                  <label className="text-body-sm font-semibold text-text" htmlFor={`refund-${item.id}`}>
                    Aantal annuleren
                  </label>
                  <select
                    id={`refund-${item.id}`}
                    value={quantities[item.id] ?? 0}
                    onChange={(event) => {
                      setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }));
                      setState("idle");
                      setRequestId(null);
                    }}
                    disabled={remaining === 0 || state === "saving"}
                    className="min-h-11 rounded-button border border-border bg-surface px-3 text-text"
                  >
                    {Array.from({ length: remaining + 1 }, (_, quantity) => (
                      <option key={quantity} value={quantity}>{quantity}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {shippingCents > 0 ? (
            <label className="flex min-h-11 items-center gap-3 text-body-sm text-text">
              <input
                type="checkbox"
                checked={includeShipping}
                onChange={(event) => {
                  setIncludeShipping(event.target.checked);
                  setState("idle");
                  setRequestId(null);
                }}
                disabled={shippingAlreadyReserved || state === "saving"}
                className="h-5 w-5"
              />
              Verzendkosten van {formatPrice(shippingCents, "nl")} ook terugbetalen
              {shippingAlreadyReserved ? " (al verwerkt)" : ""}
            </label>
          ) : null}

          <label className="block text-body-sm font-semibold text-text" htmlFor="refund-reason">
            Reden (optioneel)
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setState("idle");
                setRequestId(null);
              }}
              maxLength={500}
              rows={3}
              className="mt-1 block w-full rounded-button border border-border bg-background px-3 py-2 font-normal text-text"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="font-heading text-heading-sm text-text">
              Terug te betalen: {formatPrice(calculation?.amountCents ?? 0, "nl")}
            </p>
            <button
              type="button"
              onClick={submitRefund}
              disabled={!calculation || state === "saving"}
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-red-300 bg-red-50 px-4 py-2 font-heading text-body-sm font-semibold text-red-700 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "saving" ? "Mollie verwerkt aanvraag…" : "Annuleren en terugbetalen"}
            </button>
          </div>
          {message ? (
            <p role="status" className={`text-body-sm font-semibold ${state === "error" ? "text-red-700" : "text-green-700"}`}>
              {message}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-body-sm text-muted">
          Deelterugbetaling is alleen beschikbaar voor betaalde, niet-testbestellingen met een Mollie-betaling.
        </p>
      )}

      {refunds.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-heading text-body-md font-semibold text-text">Eerdere terugbetalingen</h3>
          <div className="mt-3 space-y-2">
            {refunds.map((refund) => (
              <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2 rounded-button bg-background px-3 py-2 text-body-sm">
                <div>
                  <p className="font-semibold text-text">{formatPrice(refund.amountCents, "nl")} · {STATUS_LABELS[refund.status] ?? refund.status}</p>
                  <p className="text-muted">{new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(refund.createdAt))}{refund.reason ? ` · ${refund.reason}` : ""}</p>
                </div>
                {refund.mollieRefundId ? <span className="font-mono text-xs text-muted">{refund.mollieRefundId}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
