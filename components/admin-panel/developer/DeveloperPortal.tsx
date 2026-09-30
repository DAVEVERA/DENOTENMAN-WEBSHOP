"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  Save,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import type { DeveloperInvoiceDto, DeveloperProfileDto } from "@/lib/developer-portal/service";
import { computeDeveloperInvoiceTotals, type DeveloperInvoiceLine } from "@/lib/developer-portal/invoice-math";
import { statusBadgeFor } from "./invoice-status";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const labelClass = "grid gap-1 text-body-sm font-semibold text-text";
const panelClass = "rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateLabel = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" });

export function formatCents(cents: number) {
  return euro.format(cents / 100);
}

/** "1.250,50", "1250.50" and "1250" all become cents; null when it is not an amount. */
export function parseEuroToCents(value: string): number | null {
  const cleaned = value.replace(/[€\s]/gu, "");
  if (!cleaned) return null;
  const normalized = /,\d{1,2}$/u.test(cleaned) ? cleaned.replace(/\./gu, "").replace(",", ".") : cleaned.replace(/,/gu, "");
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

function parseQuantity(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const amount = Number(normalized);
  return amount > 0 ? amount : null;
}

type ApiError = { error?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.message || "Er ging iets mis. Probeer het opnieuw.");
  return body;
}

const eventLabels: Record<string, string> = {
  CREATED: "Aangemaakt",
  UPDATED: "Aangepast",
  SENT: "Klaargezet",
  EMAIL_READY: "Melding verstuurd",
  EMAIL_FIRST_REMINDER: "Eerste herinnering verstuurd",
  EMAIL_SECOND_REMINDER: "Tweede herinnering verstuurd",
  EMAIL_FAILED: "E-mail mislukt",
  CHECKOUT_STARTED: "Betaling gestart via Stripe",
  PAID: "Betaald",
  CANCELLED: "Geannuleerd",
};

// ---------- Login ----------

function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/developer/session", { method: "POST", body: JSON.stringify({ username, password }) });
      setPassword("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inloggen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-heading-lg text-text">Ontwikkelaarsportaal</h1>
      <p className="mt-2 text-body-sm text-muted">Alleen voor de ontwikkelaar. Log in met je eigen gegevens.</p>
      {!configured ? (
        <p role="alert" className="mt-5 rounded-card border border-amber-300 bg-amber-50 p-4 text-body-sm font-semibold text-amber-900">Het portaal is nog niet ingesteld: DEVELOPER_PORTAL_PASSWORD_HASH ontbreekt op de server.</p>
      ) : (
        <form onSubmit={submit} className={`${panelClass} mt-5 grid gap-4`}>
          <label className={labelClass}>Gebruikersnaam<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className={inputClass} /></label>
          <label className={labelClass}>Wachtwoord<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className={inputClass} /></label>
          {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
          <button type="submit" disabled={busy} className={`${buttonClass} bg-accent-ink text-surface`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}Inloggen</button>
        </form>
      )}
    </div>
  );
}

// ---------- Invoice editor ----------

type LineDraft = { description: string; quantity: string; unitPrice: string; vatRate: 0 | 9 | 21 };

function todayInput() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

function draftLines(invoice?: DeveloperInvoiceDto): LineDraft[] {
  if (!invoice) return [{ description: "", quantity: "1", unitPrice: "", vatRate: 21 }];
  return invoice.lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity).replace(".", ","),
    unitPrice: (line.unitPriceCents / 100).toFixed(2).replace(".", ","),
    vatRate: line.vatRate,
  }));
}

function InvoiceEditor({ invoice, defaultTermDays, onSaved, onClose }: {
  invoice?: DeveloperInvoiceDto;
  defaultTermDays: number;
  onSaved: (invoice: DeveloperInvoiceDto) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(invoice?.title ?? "");
  const [issueDate, setIssueDate] = useState(invoice ? invoice.issueDate.slice(0, 10) : todayInput());
  const initialTerm = invoice ? Math.round((Date.parse(invoice.dueDate) - Date.parse(invoice.issueDate)) / 86_400_000) : defaultTermDays;
  const [termDays, setTermDays] = useState(String(initialTerm));
  const [lines, setLines] = useState<LineDraft[]>(() => draftLines(invoice));
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedLines = lines.map((line) => {
    const quantity = parseQuantity(line.quantity);
    const unitPriceCents = parseEuroToCents(line.unitPrice);
    return quantity !== null && unitPriceCents !== null && line.description.trim()
      ? { description: line.description.trim(), quantity, unitPriceCents, vatRate: line.vatRate } satisfies DeveloperInvoiceLine
      : null;
  });
  const validLines = parsedLines.filter((line): line is DeveloperInvoiceLine => line !== null);
  const totals = computeDeveloperInvoiceTotals(validLines);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (parsedLines.some((line) => line === null)) {
      setError("Vul bij elke regel een omschrijving, een aantal en een bedrag in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title,
        issueDate,
        paymentTermDays: Number(termDays) || 0,
        lines: validLines,
        notes: notes.trim() || null,
      };
      const body = await api<{ invoice: DeveloperInvoiceDto }>(
        invoice ? `/api/admin/developer/invoices/${encodeURIComponent(invoice.id)}` : "/api/admin/developer/invoices",
        { method: invoice ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      onSaved(body.invoice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`${panelClass} grid gap-4`} aria-labelledby="editor-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="editor-title" className="text-heading-md text-text">{invoice ? `Concept ${invoice.number} bewerken` : "Nieuwe factuur"}</h2>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-border text-text"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className={labelClass}>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Onderhoud webshop september" className={inputClass} /></label>
        <label className={labelClass}>Factuurdatum<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required className={inputClass} /></label>
        <label className={labelClass}>Betaaltermijn (dagen)<input inputMode="numeric" value={termDays} onChange={(event) => setTermDays(event.target.value.replace(/\D/gu, ""))} className={inputClass} /></label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="font-heading text-body-md font-bold text-text">Regels</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-card border border-border bg-background p-3 sm:grid-cols-[minmax(0,3fr)_5rem_8rem_6rem_auto] sm:items-end">
            <label className={labelClass}>Omschrijving<input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} maxLength={300} className={inputClass} /></label>
            <label className={labelClass}>Aantal<input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Prijs (excl.)<input inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} placeholder="0,00" className={inputClass} /></label>
            <label className={labelClass}>Btw<select value={line.vatRate} onChange={(event) => updateLine(index, { vatRate: Number(event.target.value) as 0 | 9 | 21 })} className={inputClass}><option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option></select></label>
            <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, position) => position !== index))} aria-label={`Regel ${index + 1} verwijderen`} className={`${buttonClass} border border-border bg-surface text-text`}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="sm:sr-only">Verwijderen</span></button>
          </div>
        ))}
        <button type="button" onClick={() => setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "", vatRate: 21 }])} className={`${buttonClass} justify-self-start border border-border bg-surface text-text`}><Plus className="h-4 w-4" aria-hidden="true" />Regel toevoegen</button>
      </fieldset>

      <label className={labelClass}>Opmerking op de factuur (optioneel)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className={`${inputClass} py-3`} /></label>

      <dl className="grid gap-1 justify-self-end text-body-sm sm:min-w-64">
        <div className="flex justify-between gap-6"><dt className="text-muted">Subtotaal</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
        {totals.vatByRate.map((row) => <div key={row.rate} className="flex justify-between gap-6"><dt className="text-muted">Btw {row.rate}%</dt><dd>{formatCents(row.vatCents)}</dd></div>)}
        <div className="flex justify-between gap-6 border-t border-border pt-1 font-bold"><dt>Totaal</dt><dd>{formatCents(totals.totalCents)}</dd></div>
      </dl>

      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={`${buttonClass} border border-border bg-surface text-text`}>Annuleren</button>
        <button type="submit" disabled={busy} className={`${buttonClass} bg-accent-ink text-surface`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Concept opslaan</button>
      </div>
    </form>
  );
}

// ---------- Invoice list ----------

function InvoiceCard({ invoice, busy, onEdit, onAction, onDelete }: {
  invoice: DeveloperInvoiceDto;
  busy: boolean;
  onEdit: () => void;
  onAction: (action: "send" | "resend" | "cancel" | "markPaid", via?: string) => void;
  onDelete: () => void;
}) {
  const badge = statusBadgeFor(invoice);
  const [paidVia, setPaidVia] = useState("bank");
  return (
    <li className={`${panelClass} grid gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2"><span className="font-heading text-body-md font-bold text-text">{invoice.number}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span></p>
          <p className="mt-1 break-words text-body-sm text-text">{invoice.title}</p>
          <p className="mt-1 text-xs text-muted">Factuurdatum {dateLabel.format(new Date(invoice.issueDate))} · vervalt {dateLabel.format(new Date(invoice.dueDate))}{invoice.paidAt ? ` · betaald ${dateLabel.format(new Date(invoice.paidAt))}` : ""}</p>
          {invoice.status === "SENT" ? (
            <p className="mt-1 text-xs text-muted">
              {invoice.secondReminderAt ? `Tweede herinnering verstuurd ${dateLabel.format(new Date(invoice.secondReminderAt))}.` : invoice.firstReminderAt ? `Eerste herinnering verstuurd ${dateLabel.format(new Date(invoice.firstReminderAt))}; de tweede volgt na 14 dagen.` : "Eerste herinnering volgt 7 dagen na klaarzetten als er niet is betaald."}
            </p>
          ) : null}
        </div>
        <p className="font-heading text-heading-sm font-bold text-text">{formatCents(invoice.totalCents)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice.status === "DRAFT" ? (
          <>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Factuur ${invoice.number} klaarzetten? De Notenman krijgt direct een melding.`)) onAction("send"); }} className={`${buttonClass} bg-accent text-contrast`}><Send className="h-4 w-4" aria-hidden="true" />Klaarzetten en melden</button>
            <button type="button" disabled={busy} onClick={onEdit} className={`${buttonClass} border border-border bg-surface text-text`}><FileText className="h-4 w-4" aria-hidden="true" />Bewerken</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Concept ${invoice.number} verwijderen?`)) onDelete(); }} className={`${buttonClass} border border-border bg-surface text-red-700`}><Trash2 className="h-4 w-4" aria-hidden="true" />Verwijderen</button>
          </>
        ) : null}
        {invoice.status === "SENT" ? (
          <>
            <span className="inline-flex flex-wrap items-center gap-2">
              <select value={paidVia} onChange={(event) => setPaidVia(event.target.value)} aria-label="Betaald via" className="min-h-11 rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><option value="bank">Overboeking</option><option value="stripe">Stripe</option><option value="link">Betaallink</option><option value="other">Anders</option></select>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Factuur ${invoice.number} als betaald markeren? Er gaan dan geen herinneringen meer uit.`)) onAction("markPaid", paidVia); }} className={`${buttonClass} bg-accent-ink text-surface`}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Markeer betaald</button>
            </span>
            <button type="button" disabled={busy} onClick={() => onAction("resend")} className={`${buttonClass} border border-border bg-surface text-text`}><Mail className="h-4 w-4" aria-hidden="true" />Melding opnieuw sturen</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Factuur ${invoice.number} annuleren? De Notenman ziet hem dan niet meer als openstaand.`)) onAction("cancel"); }} className={`${buttonClass} border border-border bg-surface text-red-700`}><X className="h-4 w-4" aria-hidden="true" />Annuleren</button>
          </>
        ) : null}
        {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" ? (
          <Link href={`/admin/ontwikkelaarsfacturen/${encodeURIComponent(invoice.id)}`} className={`${buttonClass} border border-border bg-surface text-text`}><ExternalLink className="h-4 w-4" aria-hidden="true" />Bekijk zoals De Notenman</Link>
        ) : null}
      </div>

      {invoice.events.length ? (
        <details className="text-body-sm">
          <summary className="cursor-pointer font-semibold text-muted">Tijdlijn ({invoice.events.length})</summary>
          <ol className="mt-2 grid gap-1 border-l border-border pl-3">
            {invoice.events.map((event, index) => (
              <li key={`${event.type}-${index}`} className={event.type === "EMAIL_FAILED" ? "text-red-700" : "text-muted"}>
                {dateLabel.format(new Date(event.createdAt))}: {eventLabels[event.type] ?? event.type}
                {event.type === "EMAIL_FAILED" && event.detail && typeof event.detail === "object" && "message" in event.detail ? ` (${String((event.detail as { message: unknown }).message)})` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}

// ---------- Settings ----------

function ProfileSettings({ profile, onSaved }: { profile: DeveloperProfileDto; onSaved: (profile: DeveloperProfileDto) => void }) {
  const [form, setForm] = useState(() => ({ ...profile, stripeSecretKey: "", removeStripeKey: false }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body = await api<{ profile: DeveloperProfileDto }>("/api/admin/developer/profile", {
        method: "PUT",
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          address: form.address,
          postalCode: form.postalCode,
          city: form.city,
          country: form.country,
          kvkNumber: form.kvkNumber,
          vatNumber: form.vatNumber,
          paymentTermDays: Number(form.paymentTermDays) || 0,
          notificationEmail: form.notificationEmail,
          bankTransferEnabled: form.bankTransferEnabled,
          iban: form.iban,
          bic: form.bic,
          accountHolder: form.accountHolder,
          stripeEnabled: form.stripeEnabled,
          ...(form.stripeSecretKey ? { stripeSecretKey: form.stripeSecretKey } : {}),
          ...(form.removeStripeKey ? { removeStripeKey: true } : {}),
          paymentLinkEnabled: form.paymentLinkEnabled,
          paymentLinkUrl: form.paymentLinkUrl,
          paymentLinkLabel: form.paymentLinkLabel,
        }),
      });
      setForm({ ...body.profile, stripeSecretKey: "", removeStripeKey: false });
      onSaved(body.profile);
      setMessage({ tone: "ok", text: "Instellingen opgeslagen." });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Opslaan mislukt." });
    } finally {
      setBusy(false);
    }
  }

  const text = (key: "businessName" | "contactName" | "email" | "address" | "postalCode" | "city" | "country" | "kvkNumber" | "vatNumber" | "notificationEmail" | "iban" | "bic" | "accountHolder" | "paymentLinkUrl" | "paymentLinkLabel", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={labelClass}>{label}<input value={form[key]} onChange={(event) => set(key, event.target.value)} className={inputClass} {...props} /></label>
  );

  return (
    <form onSubmit={save} className="grid gap-4">
      <section className={`${panelClass} grid gap-3`} aria-labelledby="profile-business">
        <h2 id="profile-business" className="text-heading-sm font-bold text-text">Jouw gegevens op de factuur</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("businessName", "Bedrijfsnaam")}
          {text("contactName", "Naam")}
          {text("email", "E-mail", { type: "email" })}
          {text("address", "Adres")}
          {text("postalCode", "Postcode")}
          {text("city", "Plaats")}
          {text("country", "Land")}
          {text("kvkNumber", "KvK-nummer")}
          {text("vatNumber", "Btw-nummer")}
          <label className={labelClass}>Standaard betaaltermijn (dagen)<input inputMode="numeric" value={String(form.paymentTermDays)} onChange={(event) => set("paymentTermDays", Number(event.target.value.replace(/\D/gu, "")) || 0)} className={inputClass} /></label>
        </div>
      </section>

      <section className={`${panelClass} grid gap-3`} aria-labelledby="profile-notify">
        <h2 id="profile-notify" className="text-heading-sm font-bold text-text">Meldingen</h2>
        <p className="text-body-sm text-muted">Hier gaan de melding &quot;factuur klaar&quot; en de herinneringen naartoe (na 7 dagen en daarna na nog 14 dagen). Leeg: het bestel-e-mailadres van De Notenman.</p>
        {text("notificationEmail", "E-mail De Notenman", { type: "email", placeholder: "Bestel-e-mailadres van de winkel" })}
      </section>

      <section className={`${panelClass} grid gap-4`} aria-labelledby="profile-payment">
        <h2 id="profile-payment" className="text-heading-sm font-bold text-text">Betaalmogelijkheden</h2>

        <div className="grid gap-3 rounded-card border border-border bg-background p-3">
          <label className="flex min-h-11 items-center gap-2 font-semibold text-text"><input type="checkbox" checked={form.stripeEnabled} onChange={(event) => set("stripeEnabled", event.target.checked)} /><CreditCard className="h-4 w-4" aria-hidden="true" />Online betalen via Stripe (iDEAL, kaart)</label>
          <p className="text-body-sm text-muted">
            {form.stripeKeyConfigured
              ? form.stripeKeyReadable ? `Sleutel ingesteld (${form.stripeKeyMode === "live" ? "live" : "test"}, ${form.stripeKeyHint}).` : "De opgeslagen sleutel kan niet meer worden gelezen. Vul hem opnieuw in."
              : "Nog geen sleutel ingesteld."}
            {" "}Gebruik bij voorkeur een restricted key (rk_…) met alleen schrijfrechten op Checkout Sessions.
          </p>
          <label className={labelClass}>{form.stripeKeyConfigured ? "Nieuwe sleutel (laat leeg om te houden)" : "Stripe secret of restricted key"}<input type="password" value={form.stripeSecretKey} onChange={(event) => set("stripeSecretKey", event.target.value)} autoComplete="off" spellCheck={false} placeholder="rk_live_…" className={inputClass} /></label>
          {form.stripeKeyConfigured ? <label className="flex min-h-11 items-center gap-2 text-body-sm text-text"><input type="checkbox" checked={form.removeStripeKey} onChange={(event) => set("removeStripeKey", event.target.checked)} />Opgeslagen sleutel verwijderen</label> : null}
        </div>

        <div className="grid gap-3 rounded-card border border-border bg-background p-3">
          <label className="flex min-h-11 items-center gap-2 font-semibold text-text"><input type="checkbox" checked={form.bankTransferEnabled} onChange={(event) => set("bankTransferEnabled", event.target.checked)} /><Banknote className="h-4 w-4" aria-hidden="true" />Overmaken naar je rekening</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {text("iban", "IBAN", { autoComplete: "off", spellCheck: false })}
            {text("bic", "BIC (optioneel)")}
            {text("accountHolder", "Tenaamstelling")}
          </div>
        </div>

        <div className="grid gap-3 rounded-card border border-border bg-background p-3">
          <label className="flex min-h-11 items-center gap-2 font-semibold text-text"><input type="checkbox" checked={form.paymentLinkEnabled} onChange={(event) => set("paymentLinkEnabled", event.target.checked)} /><Link2 className="h-4 w-4" aria-hidden="true" />Eigen betaallink (bijvoorbeeld Tikkie of PayPal)</label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {text("paymentLinkUrl", "Link", { type: "url", placeholder: "https://…" })}
            {text("paymentLinkLabel", "Knoptekst", { placeholder: "Betaal via PayPal" })}
          </div>
        </div>
      </section>

      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`text-body-sm font-semibold ${message.tone === "error" ? "text-red-700" : "text-green-800"}`}>{message.text}</p> : null}
      <button type="submit" disabled={busy} className={`${buttonClass} justify-self-start bg-accent-ink text-surface`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Instellingen opslaan</button>
    </form>
  );
}

// ---------- Portal ----------

type PortalProps =
  | { mode: "login"; configured: boolean }
  | { mode: "portal"; configured: true; initialInvoices: DeveloperInvoiceDto[]; initialProfile: DeveloperProfileDto };

export function DeveloperPortal(props: PortalProps) {
  if (props.mode === "login") return <LoginForm configured={props.configured} />;
  return <Portal initialInvoices={props.initialInvoices} initialProfile={props.initialProfile} />;
}

function Portal({ initialInvoices, initialProfile }: { initialInvoices: DeveloperInvoiceDto[]; initialProfile: DeveloperProfileDto }) {
  const router = useRouter();
  const [tab, setTab] = useState<"invoices" | "settings">("invoices");
  const [invoices, setInvoices] = useState(initialInvoices);
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState<DeveloperInvoiceDto | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const open = invoices.filter((invoice) => invoice.status === "SENT");
  const openTotal = open.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const paymentReady = (profile.stripeEnabled && profile.stripeKeyReadable) || (profile.bankTransferEnabled && Boolean(profile.iban)) || (profile.paymentLinkEnabled && Boolean(profile.paymentLinkUrl));

  function replace(invoice: DeveloperInvoiceDto) {
    setInvoices((current) => {
      const exists = current.some((item) => item.id === invoice.id);
      return exists ? current.map((item) => item.id === invoice.id ? invoice : item) : [invoice, ...current];
    });
  }

  async function action(invoice: DeveloperInvoiceDto, name: "send" | "resend" | "cancel" | "markPaid", via?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const body = await api<{ invoice: DeveloperInvoiceDto }>(`/api/admin/developer/invoices/${encodeURIComponent(invoice.id)}`, {
        method: "POST",
        body: JSON.stringify(name === "markPaid" ? { action: name, via } : { action: name }),
      });
      replace(body.invoice);
      const failed = body.invoice.events.at(-1)?.type === "EMAIL_FAILED";
      setMessage(failed
        ? { tone: "error", text: `${invoice.number} is klaargezet, maar de e-mail kon niet worden verstuurd. Probeer "Melding opnieuw sturen".` }
        : { tone: "ok", text: { send: `${invoice.number} staat klaar; De Notenman heeft een melding gekregen.`, resend: "Melding opnieuw verstuurd.", cancel: `${invoice.number} is geannuleerd.`, markPaid: `${invoice.number} staat op betaald.` }[name] });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Er ging iets mis." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(invoice: DeveloperInvoiceDto) {
    setBusy(true);
    try {
      await api(`/api/admin/developer/invoices/${encodeURIComponent(invoice.id)}`, { method: "DELETE" });
      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setMessage({ tone: "ok", text: `Concept ${invoice.number} verwijderd.` });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Verwijderen mislukt." });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/developer/session", { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-text sm:text-heading-xl">Ontwikkelaarsportaal</h1>
          <p className="mt-1 text-body-sm text-muted">Zet facturen klaar voor De Notenman. Melding, herinneringen en betaalstatus lopen daarna automatisch.</p>
        </div>
        <button type="button" onClick={() => void logout()} className={`${buttonClass} border border-border bg-surface text-text`}><LogOut className="h-4 w-4" aria-hidden="true" />Uitloggen</button>
      </header>

      <div role="tablist" aria-label="Onderdelen" className="mt-5 flex gap-2">
        <button type="button" role="tab" aria-selected={tab === "invoices"} onClick={() => setTab("invoices")} className={`${buttonClass} border ${tab === "invoices" ? "border-accent-ink bg-accent/15 text-text" : "border-border bg-surface text-muted"}`}><FileText className="h-4 w-4" aria-hidden="true" />Facturen</button>
        <button type="button" role="tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")} className={`${buttonClass} border ${tab === "settings" ? "border-accent-ink bg-accent/15 text-text" : "border-border bg-surface text-muted"}`}><Settings className="h-4 w-4" aria-hidden="true" />Instellingen</button>
      </div>

      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`mt-4 rounded-card border p-3 text-body-sm font-semibold ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{message.text}</p> : null}

      {tab === "settings" ? (
        <div className="mt-5"><ProfileSettings profile={profile} onSaved={setProfile} /></div>
      ) : (
        <div className="mt-5 grid gap-4">
          {!paymentReady ? (
            <p role="alert" className="rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900">Stel eerst een betaalmogelijkheid in (Stripe, overmaken of een betaallink) voordat je een factuur klaarzet. <button type="button" onClick={() => setTab("settings")} className="underline underline-offset-4">Naar instellingen</button></p>
          ) : null}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Samenvatting">
            <div className={panelClass}><p className="text-xs text-muted">Openstaand</p><p className="font-heading text-heading-md text-text">{formatCents(openTotal)}</p></div>
            <div className={panelClass}><p className="text-xs text-muted">Open facturen</p><p className="font-heading text-heading-md text-text">{open.length}</p></div>
            <div className={`${panelClass} col-span-2 sm:col-span-1`}><p className="text-xs text-muted">Te laat</p><p className="font-heading text-heading-md text-text">{open.filter((invoice) => invoice.overdue).length}</p></div>
          </section>

          {editing ? (
            <InvoiceEditor
              key={editing === "new" ? "new" : editing.id}
              invoice={editing === "new" ? undefined : editing}
              defaultTermDays={profile.paymentTermDays}
              onClose={() => setEditing(null)}
              onSaved={(invoice) => { replace(invoice); setEditing(null); setMessage({ tone: "ok", text: `Concept ${invoice.number} opgeslagen.` }); }}
            />
          ) : (
            <button type="button" onClick={() => setEditing("new")} className={`${buttonClass} justify-self-start bg-accent text-contrast`}><Plus className="h-4 w-4" aria-hidden="true" />Nieuwe factuur</button>
          )}

          {invoices.length ? (
            <ul className="grid gap-3">
              {invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  busy={busy}
                  onEdit={() => setEditing(invoice)}
                  onAction={(name, via) => void action(invoice, name, via)}
                  onDelete={() => void remove(invoice)}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-panel border border-dashed border-border bg-background p-6 text-center text-body-sm text-muted">Nog geen facturen. Maak je eerste factuur aan.</p>
          )}
        </div>
      )}
    </div>
  );
}
