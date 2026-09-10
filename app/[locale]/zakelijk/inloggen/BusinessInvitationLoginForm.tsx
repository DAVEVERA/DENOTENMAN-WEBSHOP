"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessInvitationLoginForm({ token, locale }: { token: string; locale: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"activate" | "password">("activate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function activate() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/business/auth/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Deze uitnodiging kan niet meer worden gebruikt. Vraag Fedor om een nieuwe link.");
        return;
      }
      setStep("password");
    } catch {
      setError("De verbinding viel weg. Probeer de uitnodiging opnieuw te openen.");
    } finally {
      setBusy(false);
    }
  }

  function enterPortal() {
    router.replace(`/${locale}/zakelijk`);
    router.refresh();
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError("Gebruik minimaal 8 tekens.");
      return;
    }
    if (password !== confirm) {
      setPasswordError("De wachtwoorden komen niet overeen.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/business/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setPasswordError("Opslaan is niet gelukt. Probeer het opnieuw.");
        return;
      }
      enterPortal();
    } catch {
      setPasswordError("De verbinding viel weg. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "password") {
    return (
      <div className="mt-6">
        <p className="text-body-sm leading-relaxed text-muted">Je bent ingelogd. Kies meteen je eigen wachtwoord, dan kun je de volgende keer ook direct met e-mailadres en wachtwoord inloggen.</p>
        <form onSubmit={submitPassword} className="mt-4 grid gap-3 rounded-card border border-border bg-background p-4 text-left">
          <div>
            <label htmlFor="business-invite-password" className="text-body-sm font-semibold text-text">Kies een wachtwoord</label>
            <input id="business-invite-password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label htmlFor="business-invite-password-confirm" className="text-body-sm font-semibold text-text">Herhaal je wachtwoord</label>
            <input id="business-invite-password-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
          </div>
          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Opslaan…" : "Wachtwoord opslaan en verder"}</button>
          {passwordError ? <p role="alert" className="text-body-sm font-semibold text-red-700">{passwordError}</p> : null}
        </form>
        <button type="button" onClick={enterPortal} className="mt-3 text-body-sm font-semibold text-accent-hover underline underline-offset-4">Later instellen, ik gebruik de e-maillink</button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button type="button" onClick={activate} disabled={busy} className="min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Veilige omgeving openen…" : "Zakelijke omgeving openen"}</button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">Door deze persoonlijke link te gebruiken activeer je toegang op dit apparaat. Deel de link niet met anderen.</p>
      {error ? <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
