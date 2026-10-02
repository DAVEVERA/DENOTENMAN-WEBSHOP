"use client";

import { CreditCard, LoaderCircle, Printer } from "lucide-react";
import { useState } from "react";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Starts Stripe Checkout for an open developer invoice. */
export function PayDeveloperInvoiceButton({ invoiceId, amountLabel }: { invoiceId: string; amountLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/developer-invoices/${encodeURIComponent(invoiceId)}/checkout`, { method: "POST" });
      const body = await response.json().catch(() => ({})) as { url?: string; message?: string };
      if (!response.ok || !body.url) throw new Error(body.message || "De betaalpagina kon niet worden geopend.");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De betaalpagina kon niet worden geopend.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" disabled={busy} onClick={() => void pay()} className={`${buttonClass} bg-accent text-contrast`}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
        Betaal {amountLabel} met iDEAL
      </button>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

export function PrintInvoiceButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass} border border-border bg-surface text-text`}>
      <Printer className="h-4 w-4" aria-hidden="true" />Afdrukken of opslaan als pdf
    </button>
  );
}
