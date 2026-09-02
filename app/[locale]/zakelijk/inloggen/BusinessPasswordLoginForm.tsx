"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mailadres of wachtwoord onjuist.",
  TOO_MANY_ATTEMPTS: "Te veel pogingen. Probeer het over een paar minuten opnieuw.",
};

export function BusinessPasswordLoginForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/business/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError((data?.error && ERROR_MESSAGES[data.error]) || "Inloggen is niet gelukt. Probeer het opnieuw.");
        return;
      }
      router.replace(`/${locale}/zakelijk`);
      router.refresh();
    } catch {
      setError("De verbinding viel weg. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-3 rounded-card border border-border bg-background p-4 text-left">
      <div>
        <label htmlFor="business-password-email" className="text-body-sm font-semibold text-text">E-mailadres</label>
        <input id="business-password-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
      </div>
      <div>
        <label htmlFor="business-password-password" className="text-body-sm font-semibold text-text">Wachtwoord</label>
        <input id="business-password-password" type="password" autoComplete="current-password" required minLength={8} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
      </div>
      <button type="submit" disabled={busy} className="mt-1 min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">{busy ? "Inloggen…" : "Inloggen"}</button>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
