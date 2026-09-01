"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, LogOut, PackageCheck, Send, Clock } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { calculateVat } from "@/lib/business-vat";

type PortalItem = { id: string; productName: string; variantLabel: string | null; sku: string | null; quantity: number; unitPriceCents: number };
type PortalNote = { id: string; actorType: string; authorName: string; text: string; createdAt: string };
type PortalList = {
  id: string;
  title: string;
  status: string;
  version: number;
  totalCents: number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PortalItem[];
  notes: PortalNote[];
};

const STATUS: Record<string, string> = {
  SENT: "Klaar om te betalen",
  CHANGES_REQUESTED: "In behandeling bij Fedor",
  APPROVED: "In behandeling bij Fedor",
  PAID: "Betaald",
  CANCELLED: "Geannuleerd",
};

type PortalAccount = {
  companyName: string;
  contactName: string;
  country: string;
  vatRegime: string;
  vatRatePercent: number;
  peppolConfigured: boolean;
};

export function BusinessPortalClient({ locale, account, initialOrderLists }: { locale: string; account: PortalAccount; initialOrderLists: PortalList[] }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  async function logout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/business/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      router.replace(`/${locale}/zakelijk/inloggen`);
      router.refresh();
    } catch {
      setLogoutError("Uitloggen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-ink">Welkom {account.contactName}</p>
          <h1 className="mt-1 font-heading text-heading-lg text-text">Bestellijsten voor {account.companyName}</h1>
          <p className="mt-2 max-w-2xl text-body-sm text-muted">Dit is het voorstel van Fedor. Kloppen de aantallen niet, neem dan contact op — aanpassen kan alleen via Fedor.</p>
        </div>
        <div>
          <button type="button" onClick={logout} disabled={loggingOut} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text"><LogOut className="h-4 w-4" aria-hidden="true" /> {loggingOut ? "Uitloggen…" : "Uitloggen"}</button>
          {logoutError ? <p role="alert" className="mt-2 max-w-xs text-body-sm font-semibold text-red-700">{logoutError}</p> : null}
        </div>
      </div>
      {initialOrderLists.length === 0 ? (
        <div className="mt-8 rounded-panel border border-dashed border-border bg-surface p-6 text-center">
          <PackageCheck className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
          <h2 className="mt-3 font-heading text-heading-sm text-text">Nog geen bestellijst</h2>
          <p className="mt-1 text-body-sm text-muted">Zodra Fedor een voorstel verstuurt, verschijnt het hier automatisch.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">{initialOrderLists.map((list) => <OrderListReview key={list.id} list={list} account={account} />)}</div>
      )}
    </main>
  );
}

function OrderListReview({ list, account }: { list: PortalList; account: PortalAccount }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = list.validUntil ? new Date(list.validUntil).getTime() <= Date.now() : false;
  const payable = list.status === "SENT" && !expired;
  const { vatAmountCents, totalCents: payableTotalCents } = calculateVat(list.totalCents, account.vatRatePercent);
  const isReverseCharge = account.vatRegime === "REVERSE_CHARGE";

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/checkout`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!response.ok || !data?.checkoutUrl) {
        setError(
          data?.error === "ORDER_LIST_EXPIRED"
            ? "Deze bestellijst is verlopen. Vraag Fedor om een nieuwe versie."
            : data?.error === "ALREADY_PAID"
              ? "Deze bestellijst is al betaald."
              : "Afrekenen is niet gelukt. Probeer het opnieuw."
        );
        setBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("De verbinding viel weg. Er is niets afgeschreven; probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-[#FFF9DA] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Bestellijst</p>
            <h2 className="mt-1 font-heading text-heading-sm text-text">{list.title}</h2>
            <p className="mt-1 text-body-sm text-muted">{list.validUntil ? `Geldig tot ${formatDate(list.validUntil)}` : "Geen einddatum ingesteld"}</p>
          </div>
          <span className="rounded-button bg-surface px-3 py-2 text-xs font-bold text-text">{STATUS[list.status] ?? list.status}</span>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <ul className="divide-y divide-border rounded-card border border-border">
          {list.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-3 text-body-sm">
              <span className="min-w-0">
                <strong className="block text-text">{item.productName}</strong>
                <span className="break-words text-muted">{item.variantLabel ?? item.sku ?? "—"}</span>
              </span>
              <span className="shrink-0 text-right">
                <strong className="block text-text">{item.quantity} × {formatPrice(item.unitPriceCents, "nl")}</strong>
                <span className="text-muted">{formatPrice(item.quantity * item.unitPriceCents, "nl")}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-1 border-t border-border pt-4 text-body-sm">
          <div className="flex items-center justify-between text-muted">
            <span>Subtotaal (excl. BTW)</span>
            <span>{formatPrice(list.totalCents, "nl")}</span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>{isReverseCharge ? "BTW verlegd" : `BTW (${account.vatRatePercent}%)`}</span>
            <span>{formatPrice(vatAmountCents, "nl")}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-heading font-bold text-text">Te betalen</span>
            <span className="font-heading text-heading-sm text-text">{formatPrice(payableTotalCents, "nl")}</span>
          </div>
        </div>

        {payable ? (
          <button type="button" disabled={busy} onClick={startCheckout} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">
            <CreditCard className="h-5 w-5" aria-hidden="true" /> {busy ? "Bezig…" : `Nu afrekenen — ${formatPrice(payableTotalCents, "nl")}`}
          </button>
        ) : null}
        {list.status === "SENT" && expired ? (
          <p className="mt-6 rounded-card bg-background p-4 text-body-sm text-muted">Deze bestellijst is verlopen. Vraag Fedor om een nieuwe versie.</p>
        ) : null}
        {list.status === "CANCELLED" ? (
          <p className="mt-6 rounded-card bg-background p-4 text-body-sm text-muted">Deze bestellijst is geannuleerd.</p>
        ) : null}
        {list.status === "PAID" ? <InvoiceSection list={list} account={account} /> : null}
        {error ? <p role="alert" className="mt-4 rounded-card bg-red-50 p-3 text-body-sm font-semibold text-red-700">{error}</p> : null}

        {list.notes.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-heading font-bold text-text">Notities</h3>
            <ol className="mt-2 grid gap-2">
              {list.notes.map((item) => (
                <li key={item.id} className="rounded-card border border-border p-3 text-body-sm">
                  <div className="flex flex-wrap justify-between gap-2"><strong className="text-text">{item.authorName}</strong><time className="text-xs text-muted">{formatDateTime(item.createdAt)}</time></div>
                  <p className="mt-1 whitespace-pre-wrap text-muted">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function InvoiceSection({ list, account }: { list: PortalList; account: PortalAccount }) {
  const [peppolBusy, setPeppolBusy] = useState(false);
  const [peppolResult, setPeppolResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function sendPeppol() {
    setPeppolBusy(true);
    setPeppolResult(null);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/peppol`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setPeppolResult({ type: "error", text: data?.error === "PEPPOL_NOT_CONFIGURED" ? "Peppol-verzending is nog niet actief voor dit account." : "Versturen naar Peppol is niet gelukt." });
        return;
      }
      setPeppolResult({ type: "ok", text: "Factuur verstuurd naar je Peppol-omgeving." });
    } catch {
      setPeppolResult({ type: "error", text: "De verbinding viel weg. Probeer het opnieuw." });
    } finally {
      setPeppolBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-card border border-border bg-background p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-accent-ink" aria-hidden="true" />
        <h3 className="font-heading font-bold text-text">Factuur</h3>
      </div>
      <p className="mt-1 text-body-sm text-muted">Betaald{list.paidAt ? ` op ${formatDate(list.paidAt)}` : ""}.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`/api/business/order-lists/${list.id}/invoice`}
          className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text hover:border-border-hover"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Factuur downloaden (PDF)
        </a>
        {account.country === "BE" ? (
          account.peppolConfigured ? (
            <button type="button" disabled={peppolBusy} onClick={sendPeppol} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-accent bg-surface px-4 font-heading text-body-sm font-bold text-accent-hover disabled:opacity-60">
              <Send className="h-4 w-4" aria-hidden="true" /> {peppolBusy ? "Bezig…" : "Verstuur via Peppol"}
            </button>
          ) : (
            <span title="Peppol-verzending wordt binnenkort beschikbaar" className="inline-flex min-h-11 items-center gap-2 rounded-button border border-dashed border-border px-4 font-heading text-body-sm font-semibold text-muted">
              <Clock className="h-4 w-4" aria-hidden="true" /> Peppol-verzending — binnenkort beschikbaar
            </span>
          )
        ) : null}
      </div>
      {peppolResult ? (
        <p role={peppolResult.type === "error" ? "alert" : "status"} className={`mt-3 text-body-sm font-semibold ${peppolResult.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {peppolResult.text}
        </p>
      ) : null}
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
