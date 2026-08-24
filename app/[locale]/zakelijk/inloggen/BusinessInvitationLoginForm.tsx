"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessInvitationLoginForm({ token, locale }: { token: string; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function activate() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/business/auth/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Deze uitnodiging kan niet meer worden gebruikt. Vraag Fedor om een nieuwe link.");
        return;
      }
      router.replace(`/${locale}/zakelijk`); router.refresh();
    } catch {
      setError("De verbinding viel weg. Probeer de uitnodiging opnieuw te openen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6">
      <button type="button" onClick={activate} disabled={busy} className="min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Veilige omgeving openen…" : "Zakelijke omgeving openen"}</button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">Door deze persoonlijke link te gebruiken activeer je toegang op dit apparaat. Deel de link niet met anderen.</p>
      {error ? <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
