"use client";

import Link from "next/link";
import { Banknote, CreditCard, ExternalLink, LoaderCircle, Paperclip } from "lucide-react";
import { useState } from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateLabel = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" });
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export type OpenInvoice = {
  id: string;
  number: string;
  title: string;
  dueDate: string;
  overdue: boolean;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  hasAttachment: boolean;
};

type Payment = { stripe: boolean; bankTransfer: { iban: string; accountHolder: string } | null; link: { url: string; label: string } | null };

function money(cents: number) {
  return euro.format(cents / 100);
}

function groupedIban(iban: string) {
  return iban.replace(/\s+/gu, "").replace(/(.{4})(?=.)/gu, "$1 ");
}

/** Open developer invoices with a running total and one payment for the selection. */
export function OpenInvoicesPayPanel({ invoices, payment }: { invoices: OpenInvoice[]; payment: Payment }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(invoices.map((invoice) => invoice.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = invoices.filter((invoice) => selected.has(invoice.id));
  const sum = (key: "subtotalCents" | "vatCents" | "totalCents") => chosen.reduce((total, invoice) => total + invoice[key], 0);
  const allChosen = chosen.length === invoices.length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/developer-invoices/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: chosen.map((invoice) => invoice.id) }),
      });
      const body = await response.json().catch(() => ({})) as { url?: string; message?: string };
      if (!response.ok || !body.url) throw new Error(body.message || "De betaalpagina kon niet worden geopend.");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De betaalpagina kon niet worden geopend.");
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-panel border border-accent-ink bg-surface p-4 shadow-card sm:p-5" aria-labelledby="open-invoices-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="open-invoices-title" className="text-heading-sm font-bold text-text">Openstaand</h2>
        {invoices.length > 1 ? (
          <button type="button" onClick={() => setSelected(allChosen ? new Set() : new Set(invoices.map((invoice) => invoice.id)))} className="min-h-11 text-body-sm font-semibold text-accent-ink underline underline-offset-4">
            {allChosen ? "Niets selecteren" : "Alles selecteren"}
          </button>
        ) : null}
      </div>

      <ul className="grid gap-2">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-start gap-3 rounded-card border border-border bg-background p-3">
            <input type="checkbox" checked={selected.has(invoice.id)} onChange={(event) => toggle(invoice.id, event.target.checked)} aria-label={`${invoice.number} meenemen in de betaling`} className="mt-1 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2"><Link href={`/admin/ontwikkelaarsfacturen/${encodeURIComponent(invoice.id)}`} className="font-heading font-bold text-accent-ink underline underline-offset-4">{invoice.number}</Link>{invoice.overdue ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-800">Te laat</span> : null}</p>
              <p className="break-words text-body-sm text-text">{invoice.title}</p>
              <p className="text-xs text-muted">Uiterlijk {dateLabel.format(new Date(invoice.dueDate))}</p>
              {invoice.hasAttachment ? <a href={`/api/admin/developer-invoices/${encodeURIComponent(invoice.id)}/attachment`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-accent-ink underline underline-offset-4"><Paperclip className="h-4 w-4" aria-hidden="true" />Originele factuur</a> : null}
            </div>
            <dl className="grid shrink-0 justify-items-end gap-0.5 text-body-sm">
              <div className="flex gap-2"><dt className="text-muted">Subtotaal</dt><dd>{money(invoice.subtotalCents)}</dd></div>
              <div className="flex gap-2"><dt className="text-muted">Btw</dt><dd>{money(invoice.vatCents)}</dd></div>
              <div className="flex gap-2 font-semibold"><dt>Totaal</dt><dd>{money(invoice.totalCents)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      <dl className="ml-auto grid w-full max-w-xs gap-1 text-body-sm" aria-label="Totaal van de selectie">
        <div className="flex justify-between gap-6"><dt className="text-muted">Subtotaal ({chosen.length} {chosen.length === 1 ? "factuur" : "facturen"})</dt><dd>{money(sum("subtotalCents"))}</dd></div>
        <div className="flex justify-between gap-6"><dt className="text-muted">Btw</dt><dd>{money(sum("vatCents"))}</dd></div>
        <div className="flex justify-between gap-6 border-t border-border pt-1 font-heading text-body-md font-bold"><dt>Totaal</dt><dd>{money(sum("totalCents"))}</dd></div>
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        {payment.stripe ? (
          <button type="button" disabled={busy || !chosen.length} onClick={() => void pay()} className={`${buttonClass} bg-accent text-contrast`}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
            Betaal {money(sum("totalCents"))} online
          </button>
        ) : null}
        {payment.link ? <a href={payment.link.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass} border border-border bg-surface text-text`}><ExternalLink className="h-4 w-4" aria-hidden="true" />{payment.link.label || "Betaallink openen"}</a> : null}
      </div>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
      {payment.bankTransfer && chosen.length ? (
        <p className="flex gap-2 text-body-sm text-text"><Banknote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>Of maak {money(sum("totalCents"))} over naar <strong>{groupedIban(payment.bankTransfer.iban)}</strong> t.n.v. {payment.bankTransfer.accountHolder}, onder vermelding van <strong>{chosen.map((invoice) => invoice.number).join(", ")}</strong>. De ontwikkelaar zet de facturen daarna op betaald.</span></p>
      ) : null}
    </section>
  );
}
