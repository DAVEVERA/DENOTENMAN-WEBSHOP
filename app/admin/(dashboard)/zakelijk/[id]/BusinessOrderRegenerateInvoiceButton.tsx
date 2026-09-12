"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessOrderRegenerateInvoiceButton({ businessAccountId, orderId }: { businessAccountId: string; orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function regenerate() {
    if (!window.confirm("Factuur opnieuw genereren voor deze bestelling? De klant krijgt hier geen e-mail over.")) return;
    setState("busy");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${businessAccountId}/orders/${orderId}/regenerate-invoice`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string; invoiceNumber?: string } | null;
      if (!response.ok) {
        setState("error");
        setMessage(
          data?.error === "INVOICE_GENERATION_FAILED"
            ? "De factuur kon niet worden gegenereerd. Probeer het opnieuw."
            : "Regenereren is mislukt."
        );
        return;
      }
      router.refresh();
    } catch {
      setState("error");
      setMessage("De verbinding viel weg. Controleer of de factuur is aangemaakt voordat je opnieuw probeert.");
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={regenerate}
        disabled={state === "busy"}
        className="inline-flex min-h-9 items-center rounded-button border border-border bg-white px-3 text-xs font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "busy" ? "Bezig…" : "Regenereer factuur"}
      </button>
      {message ? <p role={state === "error" ? "alert" : "status"} className="mt-1 text-xs font-semibold text-red-700">{message}</p> : null}
    </div>
  );
}
