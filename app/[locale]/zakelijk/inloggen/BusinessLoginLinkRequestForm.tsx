"use client";

import { useState } from "react";

export function BusinessLoginLinkRequestForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("busy");
    try {
      const response = await fetch("/api/business/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <p role="status" className="mt-6 rounded-card border border-green-200 bg-green-50 p-4 text-body-sm font-semibold leading-relaxed text-green-800">Als dit e-mailadres bij een actief zakelijk account hoort, ontvangt u een persoonlijke inloglink. Controleer ook de spammap.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-card border border-border bg-background p-4 text-left">
      <label htmlFor="business-login-email" className="text-body-sm font-semibold text-text">Zakelijk e-mailadres</label>
      <input id="business-login-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
      <button type="submit" disabled={state === "busy"} className="mt-3 min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">{state === "busy" ? "Inloglink aanvragen…" : "Stuur mij een inloglink"}</button>
      <p className="mt-3 text-xs leading-relaxed text-muted">Om bedrijfsgegevens te beschermen bevestigen we niet of een e-mailadres bij ons bekend is. Per e-mailadres geldt een wachttijd van tien minuten.</p>
      {state === "error" ? <p role="alert" className="mt-3 text-body-sm font-semibold text-red-700">Aanvragen lukte niet. Controleer uw verbinding en probeer opnieuw.</p> : null}
    </form>
  );
}
