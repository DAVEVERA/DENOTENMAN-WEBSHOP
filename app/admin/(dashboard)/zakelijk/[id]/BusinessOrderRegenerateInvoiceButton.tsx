"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessOrderRegenerateInvoiceButton({ businessAccountId, orderId }: { businessAccountId: string; orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  async function regenerate() {
    if (!window.confirm("Factuur opnieuw genereren voor deze bestelling? De klant krijgt hier geen e-mail over.")) return;
    setState("busy");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${businessAccountId}/orders/${orderId}/regenerate-invoice`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string; invoiceNumber?: string } | null;
      if (!response.ok) {
        setState("error");
        setMessage({
          text:
            data?.error === "INVOICE_GENERATION_FAILED"
              ? "De factuur kon niet worden gegenereerd. Probeer het opnieuw."
              : "Regenereren is mislukt.",
          tone: "error",
        });
        return;
      }
      setState("idle");
      setMessage({ text: "Factuur staat klaar.", tone: "success" });
      router.refresh();
    } catch {
      setState("error");
      setMessage({ text: "De verbinding viel weg. Controleer of de factuur is aangemaakt voordat je opnieuw probeert.", tone: "error" });
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
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-1 text-xs font-semibold ${message.tone === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
