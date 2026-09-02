"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

export function BusinessPasswordSettings({ hasPassword: initialHasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({ type: "error", text: "Gebruik minimaal 8 tekens." });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "De wachtwoorden komen niet overeen." });
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
        setMessage({ type: "error", text: "Opslaan is niet gelukt. Probeer het opnieuw." });
        return;
      }
      setHasPassword(true);
      setPassword("");
      setConfirm("");
      setMessage({ type: "ok", text: "Wachtwoord opgeslagen. Je kunt nu ook inloggen met e-mailadres en wachtwoord." });
    } catch {
      setMessage({ type: "error", text: "De verbinding viel weg. Probeer het opnieuw." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-card border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 text-left font-heading text-body-sm font-bold text-text">
        <KeyRound className="h-4 w-4 text-accent-ink" aria-hidden="true" />
        {hasPassword ? "Wachtwoord wijzigen" : "Wachtwoord instellen"}
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-3 grid gap-3">
          <p className="text-body-sm text-muted">{hasPassword ? "Stel een nieuw wachtwoord in om voortaan direct in te loggen, naast de inloglink." : "Stel een wachtwoord in zodat je voortaan direct kunt inloggen, naast de inloglink per e-mail."}</p>
          <div>
            <label htmlFor="business-new-password" className="text-body-sm font-semibold text-text">Nieuw wachtwoord</label>
            <input id="business-new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label htmlFor="business-new-password-confirm" className="text-body-sm font-semibold text-text">Bevestig wachtwoord</label>
            <input id="business-new-password-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
          </div>
          <button type="submit" disabled={busy} className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Opslaan…" : "Wachtwoord opslaan"}</button>
          {message ? <p role={message.type === "error" ? "alert" : "status"} className={`text-body-sm font-semibold ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>{message.text}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
