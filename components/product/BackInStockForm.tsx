"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import type { Locale } from "@/lib/i18n";

const copy = {
  nl: { title: "Geef me een seintje", intro: "Ontvang één e-mail zodra dit product weer besteld kan worden.", email: "E-mailadres", consent: "Ja, stuur mij voor dit product een eenmalige voorraadmelding.", submit: "Houd mij op de hoogte", sent: "Gelukt. Je ontvangt een seintje zodra het product weer actief is.", error: "Aanmelden lukte niet. Probeer het opnieuw." },
  en: { title: "Notify me", intro: "Receive one email when this product can be ordered again.", email: "Email address", consent: "Yes, send me a one-time stock alert for this product.", submit: "Notify me", sent: "Done. We'll email you when the product is available again.", error: "We could not save your request. Please try again." },
  fr: { title: "Prévenez-moi", intro: "Recevez un e-mail lorsque ce produit pourra de nouveau être commandé.", email: "Adresse e-mail", consent: "Oui, envoyez-moi une alerte unique pour ce produit.", submit: "Me prévenir", sent: "C'est noté. Nous vous préviendrons lorsque le produit sera disponible.", error: "L'inscription a échoué. Veuillez réessayer." },
} as const;

export function BackInStockForm({ productId, locale }: { productId: string; locale: Locale }) {
  const labels = copy[locale];
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving");
    const response = await fetch("/api/stock-notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, email, locale, consent, website: "" }) });
    setStatus(response.ok ? "sent" : "error");
  }

  if (status === "sent") return <div className="mt-5 rounded-card border border-green-200 bg-green-50 p-4 text-body-sm font-semibold text-green-800" role="status">{labels.sent}</div>;
  return <form onSubmit={submit} className="mt-5 rounded-card border border-accent/50 bg-[#FFF9DA] p-4">
    <h2 className="flex items-center gap-2 font-heading text-heading-sm text-text"><Bell className="h-5 w-5 text-accent-hover" />{labels.title}</h2>
    <p className="mt-1 text-body-sm text-muted">{labels.intro}</p>
    <label className="mt-3 block text-body-sm font-semibold text-text">{labels.email}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-12 w-full rounded-button border border-border bg-white px-3" /></label>
    <label className="mt-3 flex items-start gap-3 text-xs leading-relaxed text-muted"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />{labels.consent}</label>
    <button type="submit" disabled={status === "saving" || !consent} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-button bg-accent px-5 font-heading font-bold text-contrast disabled:opacity-60">{status === "saving" ? "…" : labels.submit}</button>
    {status === "error" ? <p className="mt-2 text-body-sm text-red-700" role="alert">{labels.error}</p> : null}
  </form>;
}
