"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

export function BusinessAccountSettings({
  vatNumber: initialVatNumber,
  peppolParticipantId: initialPeppolParticipantId,
  country,
}: {
  vatNumber: string | null;
  peppolParticipantId: string | null;
  country: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vatNumber, setVatNumber] = useState(initialVatNumber ?? "");
  const [peppolParticipantId, setPeppolParticipantId] = useState(initialPeppolParticipantId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const isBelgian = country === "BE";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, string | null> = { vatNumber: vatNumber.trim() || null };
      if (isBelgian) body.peppolParticipantId = peppolParticipantId.trim() || null;
      const response = await fetch("/api/business/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage({ type: "error", text: "Opslaan is niet gelukt. Probeer het opnieuw." });
        return;
      }
      setMessage({ type: "ok", text: "Gegevens opgeslagen." });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "De verbinding viel weg. Probeer het opnieuw." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-card border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 text-left font-heading text-body-sm font-bold text-text">
        <Building2 className="h-4 w-4 text-accent-ink" aria-hidden="true" />
        Bedrijfsgegevens
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <div>
            <label htmlFor="business-vat-number" className="text-body-sm font-semibold text-text">BTW-nummer</label>
            <input
              id="business-vat-number"
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              maxLength={30}
              placeholder={isBelgian ? "Bijv. BE0123456789" : "Bijv. NL123456789B01"}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {isBelgian ? (
            <div>
              <label htmlFor="business-peppol-id" className="text-body-sm font-semibold text-text">Peppol-ID</label>
              <input
                id="business-peppol-id"
                value={peppolParticipantId}
                onChange={(event) => setPeppolParticipantId(event.target.value)}
                maxLength={60}
                placeholder="Bijv. 0208:0123456789"
                className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <p className="mt-1 text-xs text-muted">Nodig om facturen automatisch naar je Peppol-omgeving te laten versturen.</p>
            </div>
          ) : null}
          <button type="submit" disabled={busy} className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Opslaan…" : "Opslaan"}</button>
          {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-body-sm font-semibold ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>{message.text}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
