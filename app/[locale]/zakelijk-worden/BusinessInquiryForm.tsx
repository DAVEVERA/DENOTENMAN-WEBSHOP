"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { pagePath } from "@/lib/pages";

const fieldClass = "mt-1 min-h-12 w-full rounded-button border border-border bg-white px-3 py-2 text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function BusinessInquiryForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/business/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("SEND_FAILED");
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <div className="mt-7 rounded-panel border border-green-200 bg-green-50 p-6 text-green-900" role="status"><h3 className="font-heading text-heading-sm font-bold">Bedankt voor je bericht</h3><p className="mt-2">Je zakelijke aanvraag is verstuurd. We nemen contact met je op via het opgegeven e-mailadres of telefoonnummer.</p><button type="button" onClick={() => setStatus("idle")} className="mt-4 min-h-11 font-semibold underline">Nog een bericht sturen</button></div>;
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-5 rounded-panel border border-border bg-surface p-5 shadow-card sm:grid-cols-2 sm:p-7" aria-label="Contactformulier voor zakelijke klanten">
      <label className="text-body-sm font-semibold">Bedrijfsnaam <span aria-hidden="true">*</span><input className={fieldClass} name="companyName" autoComplete="organization" maxLength={120} required /></label>
      <label className="text-body-sm font-semibold">Naam contactpersoon <span aria-hidden="true">*</span><input className={fieldClass} name="contactName" autoComplete="name" maxLength={120} required /></label>
      <label className="text-body-sm font-semibold">Zakelijk e-mailadres <span aria-hidden="true">*</span><input className={fieldClass} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label className="text-body-sm font-semibold">Telefoonnummer <span className="font-normal text-muted">(optioneel)</span><input className={fieldClass} name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label className="text-body-sm font-semibold sm:col-span-2">Waar wil je over spreken?<select className={fieldClass} name="topic" defaultValue="bestellijst"><option value="bestellijst">Een zakelijke bestellijst</option><option value="assortiment">Assortiment en hoeveelheden</option><option value="levering">Bezorging of afhalen</option><option value="anders">Iets anders</option></select></label>
      <label className="text-body-sm font-semibold sm:col-span-2">Vertel ons over jouw plannen <span aria-hidden="true">*</span><textarea className={`${fieldClass} min-h-36 resize-y`} name="message" minLength={10} maxLength={3000} required placeholder="Bijvoorbeeld: welk type bedrijf je hebt, welke producten je zoekt en hoe vaak je wilt bestellen." /></label>
      <div className="sr-only" aria-hidden="true"><label>Laat dit veld leeg<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="sm:col-span-2">
        <p className="text-xs leading-relaxed text-muted">We gebruiken je gegevens om je zakelijke aanvraag te beantwoorden. Lees onze <Link href={pagePath("privacy", "nl")} className="font-semibold underline">privacyverklaring</Link>.</p>
        <button type="submit" disabled={status === "sending"} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-button bg-accent px-6 py-3 font-heading font-bold text-contrast hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60">{status === "sending" ? "Versturen…" : "Verstuur zakelijke aanvraag"}</button>
        {status === "error" ? <p role="alert" className="mt-3 text-body-sm font-semibold text-red-700">Versturen is niet gelukt. Probeer het opnieuw of mail ons rechtstreeks via info@denotenman.com.</p> : null}
      </div>
    </form>
  );
}
