"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export function ConceptInvoiceButton({
  accountId,
  orderListId,
  disabled = false,
}: {
  accountId: string;
  orderListId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${accountId}/order-lists/${orderListId}/concept-invoice`);
      if (!response.ok) {
        setError("Concept-factuur kon niet worden gemaakt.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("De verbinding viel weg. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        title={disabled ? "Niet alle regels hebben een prijs" : "Concept-factuur (PDF) downloaden"}
        className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-white px-4 font-heading text-body-sm font-bold text-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {busy ? "Bezig…" : "Concept-factuur (PDF)"}
      </button>
      {disabled ? (
        <span className="text-xs text-muted">Vul eerst alle prijzen in — er staan regels op &quot;prijs op aanvraag&quot;.</span>
      ) : null}
      {error ? <span role="alert" className="text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}
