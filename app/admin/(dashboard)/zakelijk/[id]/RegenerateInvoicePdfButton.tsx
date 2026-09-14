"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegenerateInvoicePdfButton({ businessAccountId, invoiceId }: { businessAccountId: string; invoiceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function regenerate() {
    if (!window.confirm("PDF van deze factuur opnieuw genereren met het huidige sjabloon? Bedragen en factuurnummer blijven ongewijzigd. De klant krijgt hier geen e-mail over.")) return;
    setState("busy");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/business-accounts/${businessAccountId}/invoices/${invoiceId}/regenerate-pdf`,
        { method: "POST" }
      );
      if (!response.ok) {
        setState("error");
        setMessage("PDF opnieuw genereren is mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setState("error");
      setMessage("De verbinding viel weg. Probeer het opnieuw.");
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={regenerate}
        disabled={state === "busy"}
        className="font-heading text-body-sm font-bold text-accent-hover underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "busy" ? "Bezig…" : "PDF opnieuw genereren"}
      </button>
      {message ? <span role="alert" className="mt-0.5 text-xs font-semibold text-red-700">{message}</span> : null}
    </span>
  );
}
