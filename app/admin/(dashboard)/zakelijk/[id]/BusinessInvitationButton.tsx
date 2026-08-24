"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessInvitationButton({ businessAccountId, email, disabled }: { businessAccountId: string; email: string; disabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!window.confirm(`Persoonlijke uitnodiging versturen naar ${email}? Een eerdere ongebruikte link wordt ingetrokken.`)) return;
    setState("busy");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${businessAccountId}/invitations`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!response.ok) {
        setState("error");
        setMessage(data?.message ?? "Uitnodiging versturen is mislukt.");
        return;
      }
      setState("sent");
      setMessage("Uitnodiging is door de e-mailprovider geaccepteerd.");
      router.refresh();
    } catch {
      setState("error");
      setMessage("De verbinding viel weg. De verzending is niet bevestigd; controleer de status voordat je opnieuw probeert.");
    }
  }

  return (
    <div>
      <button type="button" onClick={send} disabled={disabled || state === "busy"} className="inline-flex min-h-12 w-full items-center justify-center rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        {state === "busy" ? "Versturen…" : "Persoonlijke uitnodiging sturen"}
      </button>
      {disabled ? <p className="mt-2 text-body-sm text-muted">Keur het account goed voordat je toegang verstuurt.</p> : null}
      {message ? <p role={state === "error" ? "alert" : "status"} className={`mt-2 text-body-sm font-semibold ${state === "error" ? "text-red-700" : "text-green-700"}`}>{message}</p> : null}
    </div>
  );
}
