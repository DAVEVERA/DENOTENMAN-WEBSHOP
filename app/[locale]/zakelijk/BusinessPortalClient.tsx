"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, MessageSquareText, PackageCheck } from "lucide-react";
import { formatPrice } from "@/lib/format";

type PortalItem = { id: string; productName: string; variantLabel: string | null; sku: string | null; quantity: number; unitPriceCents: number };
type PortalNote = { id: string; actorType: string; authorName: string; text: string; createdAt: string };
type PortalList = { id: string; title: string; status: string; version: number; totalCents: number; validUntil: string | null; sentAt: string | null; approvedAt: string | null; createdAt: string; updatedAt: string; items: PortalItem[]; notes: PortalNote[] };

const STATUS: Record<string, string> = { SENT: "Klaar voor controle", CHANGES_REQUESTED: "Wijzigingen doorgegeven", APPROVED: "Goedgekeurd", CANCELLED: "Geannuleerd" };

export function BusinessPortalClient({ locale, account, initialOrderLists }: { locale: string; account: { companyName: string; contactName: string }; initialOrderLists: PortalList[] }) {
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
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-ink">Welkom {account.contactName}</p><h1 className="mt-1 font-heading text-heading-lg text-text">Bestellijsten voor {account.companyName}</h1><p className="mt-2 max-w-2xl text-body-sm text-muted">Controleer de aantallen, laat een notitie voor Fedor achter en keur het voorstel pas goed wanneer alles klopt.</p></div>
        <div><button type="button" onClick={logout} disabled={loggingOut} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text"><LogOut className="h-4 w-4" aria-hidden="true" /> {loggingOut ? "Uitloggen…" : "Uitloggen"}</button>{logoutError ? <p role="alert" className="mt-2 max-w-xs text-body-sm font-semibold text-red-700">{logoutError}</p> : null}</div>
      </div>
      {initialOrderLists.length === 0 ? <div className="mt-8 rounded-panel border border-dashed border-border bg-surface p-6 text-center"><PackageCheck className="mx-auto h-8 w-8 text-accent" aria-hidden="true" /><h2 className="mt-3 font-heading text-heading-sm text-text">Nog geen bestellijst</h2><p className="mt-1 text-body-sm text-muted">Zodra Fedor een voorstel verstuurt, verschijnt het hier automatisch.</p></div> : <div className="mt-8 grid gap-6">{initialOrderLists.map((list) => <OrderListReview key={list.id} list={list} />)}</div>}
    </main>
  );
}

function OrderListReview({ list }: { list: PortalList }) {
  const router = useRouter();
  const editable = list.status === "SENT" || list.status === "CHANGES_REQUESTED";
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(list.items.map((item) => [item.id, item.quantity])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const changed = list.items.some((item) => quantities[item.id] !== item.quantity);
  const total = useMemo(() => list.items.reduce((sum, item) => sum + item.unitPriceCents * (quantities[item.id] ?? item.quantity), 0), [list.items, quantities]);

  async function mutate(body: Record<string, unknown>, success: string) {
    setBusy(String(body.action)); setFeedback(null);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback({ type: "error", text: data?.error === "VERSION_CONFLICT" ? "Fedor heeft deze lijst ondertussen bijgewerkt. De nieuwste versie wordt geladen." : data?.error === "ORDER_LIST_EXPIRED" ? "Deze bestellijst is verlopen. Vraag Fedor om een nieuwe versie." : "Bijwerken is mislukt. Probeer het opnieuw." });
        if (data?.error === "VERSION_CONFLICT") router.refresh();
        return false;
      }
      setFeedback({ type: "ok", text: success });
      router.refresh();
      return true;
    } catch {
      setFeedback({ type: "error", text: "De verbinding viel weg. Je wijziging is niet bevestigd; probeer het opnieuw." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-[#FFF9DA] p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Bestellijst</p><h2 className="mt-1 font-heading text-heading-sm text-text">{list.title}</h2><p className="mt-1 text-body-sm text-muted">{list.validUntil ? `Geldig tot ${formatDate(list.validUntil)}` : "Geen einddatum ingesteld"}</p></div><span className="rounded-button bg-surface px-3 py-2 text-xs font-bold text-text">{STATUS[list.status] ?? list.status}</span></div></div>
      <div className="p-4 sm:p-6">
        <div className="grid gap-3">
          {list.items.map((item) => (
            <div key={item.id} className="rounded-card border border-border p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-heading font-bold text-text">{item.productName}</h3><p className="break-words text-body-sm text-muted">{item.variantLabel ?? item.sku ?? "Variant"}</p></div><p className="shrink-0 text-right text-body-sm font-semibold text-text">{formatPrice(item.unitPriceCents, "nl")}<span className="block text-xs font-normal text-muted">per stuk</span></p></div>
              <div className="mt-3 flex items-end justify-between gap-4"><label className="text-body-sm font-semibold text-text">Aantal<input aria-label={`Aantal ${item.productName}`} type="number" min={1} step={1} disabled={!editable} value={quantities[item.id] ?? item.quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.max(1, Number(event.target.value) || 1) }))} className="mt-1 block min-h-12 w-24 rounded-button border border-border bg-background px-3 text-center text-body-md disabled:opacity-70" /></label><p className="font-heading font-bold text-text">{formatPrice(item.unitPriceCents * (quantities[item.id] ?? item.quantity), "nl")}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="font-heading font-bold text-text">Totaal voorstel</span><span className="font-heading text-heading-sm text-text">{formatPrice(total, "nl")}</span></div>
        {editable ? (
          <div className="mt-6 grid gap-4">
            {changed ? <button type="button" disabled={busy !== null} onClick={() => mutate({ action: "UPDATE_QUANTITIES", version: list.version, items: list.items.map((item) => ({ id: item.id, quantity: quantities[item.id] })) }, "De aangepaste aantallen zijn aan Fedor doorgegeven.")} className="min-h-12 w-full rounded-button border border-accent bg-surface px-5 font-heading font-bold text-accent-hover disabled:opacity-60">{busy === "UPDATE_QUANTITIES" ? "Aantallen opslaan…" : "Aangepaste aantallen doorgeven"}</button> : null}
            <div className="rounded-card bg-background p-4"><label className="text-body-sm font-semibold text-text">Notitie voor Fedor<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={4000} placeholder="Bijvoorbeeld een aflevervoorkeur of vraag over een product…" className="mt-1 w-full rounded-button border border-border bg-surface p-3 text-body-md" /></label><button type="button" disabled={busy !== null || note.trim().length === 0} onClick={async () => { if (await mutate({ action: "ADD_NOTE", text: note.trim() }, "Je notitie is bij Fedor binnengekomen.")) setNote(""); }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text disabled:opacity-50 sm:w-auto"><MessageSquareText className="h-4 w-4" aria-hidden="true" /> Notitie versturen</button></div>
            <button type="button" disabled={busy !== null || changed} onClick={() => mutate({ action: "APPROVE", version: list.version }, "Bestellijst goedgekeurd. Fedor heeft direct een melding gekregen.")} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-50"><Check className="h-5 w-5" aria-hidden="true" /> Bestellijst goedkeuren</button>
            {changed ? <p className="text-center text-xs font-semibold text-muted">Sla eerst de aangepaste aantallen op voordat je goedkeurt.</p> : null}
          </div>
        ) : null}
        {list.notes.length > 0 ? <div className="mt-6"><h3 className="font-heading font-bold text-text">Notities</h3><ol className="mt-2 grid gap-2">{list.notes.map((item) => <li key={item.id} className="rounded-card border border-border p-3 text-body-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="text-text">{item.authorName}</strong><time className="text-xs text-muted">{formatDateTime(item.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-muted">{item.text}</p></li>)}</ol></div> : null}
        {feedback ? <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-card p-3 text-body-sm font-semibold ${feedback.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{feedback.text}</p> : null}
      </div>
    </article>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
