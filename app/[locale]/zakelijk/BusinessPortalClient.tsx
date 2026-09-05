"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CreditCard, Download, LogOut, PackageCheck, Save, Send, Clock, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { calculateVat } from "@/lib/business-vat";
import { BusinessPasswordSettings } from "./BusinessPasswordSettings";
import { BusinessAccountSettings } from "./BusinessAccountSettings";
import { BusinessLogoSettings } from "./BusinessLogoSettings";
import { PickupDayCalendar } from "@/components/business-portal/PickupDayCalendar";
import { BusinessPortalSection } from "./BusinessPortalSection";
import { MARKET_STOPS, isMarketStopId } from "@/lib/market-schedule";

type PortalItem = {
  id: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  unitPriceCents: number | null;
  priceOnRequest: boolean;
  priceRequestedAt: string | null;
  isNew: boolean;
};
type PortalNote = { id: string; actorType: string; authorName: string; text: string; createdAt: string };
type PortalOrderHistoryItem = { id: string; productName: string; variantLabel: string | null; quantity: number; unitPriceCents: number };
type PortalCancellationRequest = {
  id: string;
  status: "PENDING" | "PROCESSED" | "REJECTED";
  reason: string | null;
  createdAt: string;
  items: { orderItemId: string; quantity: number }[];
};
type PortalOrderHistoryEntry = {
  id: string;
  status: "PAID" | "FULFILLED" | "REFUNDED" | "CANCELLED";
  date: string;
  totalCents: number;
  items: PortalOrderHistoryItem[];
  cancellationRequests: PortalCancellationRequest[];
};
type PortalList = {
  id: string;
  title: string;
  status: string;
  version: number;
  totalCents: number;
  pickupDay: string | null;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  /** A PENDING Order exists for this list — a payment is currently in flight. */
  paymentPending: boolean;
  createdAt: string;
  updatedAt: string;
  items: PortalItem[];
  notes: PortalNote[];
  /** Past completed checkout rounds for this same continuous list, newest first. */
  orderHistory: PortalOrderHistoryEntry[];
};

const STATUS: Record<string, string> = {
  SENT: "Actief",
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
  vatNumber: string | null;
  peppolConfigured: boolean;
  peppolParticipantId: string | null;
  fixedPickupLocationId: string | null;
  pickupFrequency: string | null;
  hasPassword: boolean;
};

const PICKUP_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "wekelijks",
  BIWEEKLY: "om de week",
  MONTHLY: "maandelijks",
  ON_REQUEST: "op aanvraag",
};

export function BusinessPortalClient({ locale, account, initialOrderLists, currentTime }: { locale: string; account: PortalAccount; initialOrderLists: PortalList[]; currentTime: string }) {
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
          <h1 className="mt-1 font-heading text-heading-lg text-text">Bestellijst voor {account.companyName}</h1>
          <p className="mt-2 max-w-2xl text-body-sm text-muted">Dit is de doorlopende lijst die Fedor voor je bijhoudt. Je past zelf de aantallen aan — de producten, eenheden en prijzen stelt Fedor in.</p>
        </div>
        <div>
          <button type="button" onClick={logout} disabled={loggingOut} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text"><LogOut className="h-4 w-4" aria-hidden="true" /> {loggingOut ? "Uitloggen…" : "Uitloggen"}</button>
          {logoutError ? <p role="alert" className="mt-2 max-w-xs text-body-sm font-semibold text-red-700">{logoutError}</p> : null}
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        <BusinessPortalSection title="Bedrijfs- en factuurgegevens" description="Beheer je btw-nummer en Peppol-gegevens.">
          <div className="grid max-w-sm gap-4">
            <BusinessAccountSettings vatNumber={account.vatNumber} peppolParticipantId={account.peppolParticipantId} country={account.country} />
            <BusinessLogoSettings />
          </div>
        </BusinessPortalSection>
        <BusinessPortalSection title="Wachtwoord en beveiliging" description="Wijzig het wachtwoord van je zakelijke account.">
          <div className="max-w-sm">
            <BusinessPasswordSettings hasPassword={account.hasPassword} />
          </div>
        </BusinessPortalSection>
      </div>

      <section className="mt-8" aria-labelledby="business-order-lists-heading">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Bestellen</p>
          <h2 id="business-order-lists-heading" className="mt-1 font-heading text-heading-sm text-text">Mijn bestellijsten</h2>
        </div>
        {initialOrderLists.length === 0 ? (
          <div className="rounded-panel border border-dashed border-border bg-surface p-6 text-center">
            <PackageCheck className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
            <h3 className="mt-3 font-heading text-heading-sm text-text">Nog geen bestellijst</h3>
            <p className="mt-1 text-body-sm text-muted">Zodra Fedor een voorstel verstuurt, verschijnt het hier automatisch.</p>
          </div>
        ) : (
          <div className="grid gap-6">{initialOrderLists.map((list) => <OrderListReview key={`${list.id}:${list.version}`} list={list} account={account} currentTime={currentTime} />)}</div>
        )}
      </section>
    </main>
  );
}

function OrderListReview({ list, account, currentTime }: { list: PortalList; account: PortalAccount; currentTime: string }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(list.items.map((item) => [item.id, item.quantity])));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [priceRequestBusyId, setPriceRequestBusyId] = useState<string | null>(null);
  const [priceRequestedIds, setPriceRequestedIds] = useState<Set<string>>(new Set());
  const [pickupDay, setPickupDay] = useState<Date | null>(list.pickupDay ? new Date(list.pickupDay) : null);
  const [pickupDayBusy, setPickupDayBusy] = useState(false);

  // The parent keys this component by the server version. A confirmed save,
  // admin edit or payment therefore remounts these inputs from current data.
  const dirty = useMemo(
    () => list.items.some((item) => (quantities[item.id] ?? item.quantity) !== item.quantity),
    [list.items, quantities]
  );
  const liveTotalCents = useMemo(
    () =>
      list.items.reduce(
        (sum, item) =>
          sum + (item.priceOnRequest || item.unitPriceCents === null ? 0 : (quantities[item.id] ?? item.quantity) * item.unitPriceCents),
        0
      ),
    [list.items, quantities]
  );
  const hasUnresolvedPriceRequest = useMemo(
    () => list.items.some((item) => (quantities[item.id] ?? item.quantity) > 0 && (item.priceOnRequest || item.unitPriceCents === null)),
    [list.items, quantities]
  );

  const expired = list.validUntil ? new Date(list.validUntil).getTime() <= new Date(currentTime).getTime() : false;
  const listActive = list.status === "SENT" && !expired;
  const payable = listActive && !list.paymentPending && !dirty && liveTotalCents > 0 && !hasUnresolvedPriceRequest;
  const { vatAmountCents, totalCents: payableTotalCents } = calculateVat(liveTotalCents, account.vatRatePercent);
  const isReverseCharge = account.vatRegime === "REVERSE_CHARGE";
  const fixedPickupLocation = account.fixedPickupLocationId && isMarketStopId(account.fixedPickupLocationId)
    ? MARKET_STOPS[account.fixedPickupLocationId]
    : null;
  const pickupFrequencyLabel = account.pickupFrequency
    ? PICKUP_FREQUENCY_LABELS[account.pickupFrequency]
    : null;

  // The customer may have just returned from Mollie before the webhook has
  // confirmed payment. Poll the server truth rather than trusting anything
  // from the redirect URL, and stop as soon as this checkout round is no
  // longer pending. The fixed list itself remains reusable in either case.
  useEffect(() => {
    if (!list.paymentPending) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [list.paymentPending, router]);

  function setQuantity(itemId: string, value: number) {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, Math.min(100_000, Math.round(value))) }));
  }

  async function saveQuantities() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/quantities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: list.version,
          quantities: list.items.map((item) => ({ itemId: item.id, quantity: quantities[item.id] ?? item.quantity })),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(
          data?.error === "VERSION_CONFLICT"
            ? "Deze lijst is intussen gewijzigd. De pagina wordt ververst."
            : data?.error === "CHECKOUT_IN_PROGRESS"
              ? "Er loopt al een betaling voor deze lijst. Wacht tot die is afgerond."
              : data?.error === "ORDER_LIST_EXPIRED"
                ? "Deze bestellijst is verlopen. Neem contact op met Fedor."
                : "Opslaan is niet gelukt. Probeer het opnieuw."
        );
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setSaveError("De verbinding viel weg. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  async function requestPrice(itemId: string) {
    setPriceRequestBusyId(itemId);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/items/${itemId}/request-price`, { method: "POST" });
      if (response.ok) {
        setPriceRequestedIds((current) => new Set(current).add(itemId));
      }
    } catch {
      // Silently retry-able: the button just stays visible if this failed.
    } finally {
      setPriceRequestBusyId(null);
    }
  }

  async function selectPickupDay(day: Date | null) {
    const previous = pickupDay;
    setPickupDay(day);
    setPickupDayBusy(true);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/pickup-day`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupDay: day ? day.toISOString() : null }),
      });
      if (!response.ok) setPickupDay(previous);
    } catch {
      setPickupDay(previous);
    } finally {
      setPickupDayBusy(false);
    }
  }

  async function startCheckout() {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const response = await fetch(`/api/business/order-lists/${list.id}/checkout`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!response.ok || !data?.checkoutUrl) {
        setCheckoutError(
          data?.error === "ORDER_LIST_EXPIRED"
            ? "Deze bestellijst is verlopen. Vraag Fedor om een nieuwe versie."
            : data?.error === "EMPTY_ORDER"
              ? "Kies eerst een aantal bij minstens één product."
              : data?.error === "PRICE_PENDING"
                ? "Voor minstens één gekozen product is de prijs nog niet bekend. Vraag de prijs op of wacht tot Fedor deze heeft ingevuld."
                : "Afrekenen is niet gelukt. Probeer het opnieuw."
        );
        setCheckoutBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("De verbinding viel weg. Er is niets afgeschreven; probeer het opnieuw.");
      setCheckoutBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <details open={listActive || list.paymentPending} className="group/order-list">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-[#FFF9DA] p-4 text-left outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:p-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Bestellijst</span>
            <span className="mt-1 block font-heading text-heading-sm text-text">{list.title}</span>
            <span className="mt-1 block text-body-sm text-muted">{list.validUntil ? `Geldig tot ${formatDate(list.validUntil)}` : "Geen einddatum ingesteld"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-button bg-surface px-3 py-2 text-xs font-bold text-text">{STATUS[list.status] ?? list.status}</span>
            <ChevronDown className="h-5 w-5 text-muted transition-transform duration-200 group-open/order-list:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </summary>
        <div className="border-t border-border p-4 sm:p-6">
        {listActive ? (
          <>
            <ul className="divide-y divide-border rounded-card border border-border">
              {list.items.map((item) => {
                const onRequest = item.priceOnRequest || item.unitPriceCents === null;
                const requested = priceRequestedIds.has(item.id) || item.priceRequestedAt !== null;
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-body-sm">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <strong className="block text-text">{item.productName}</strong>
                        {item.isNew ? <span className="inline-flex items-center gap-1 rounded-button bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent-hover"><Sparkles className="h-3 w-3" aria-hidden="true" /> Nieuw van Fedor</span> : null}
                      </span>
                      <span className="break-words text-muted">
                        {item.variantLabel ?? item.sku ?? "—"} · {onRequest ? "Prijs op aanvraag" : `${formatPrice(item.unitPriceCents!, "nl")} per stuk`}
                      </span>
                    </span>
                    <label className="flex shrink-0 items-center gap-2">
                      <span className="sr-only">Aantal voor {item.productName}</span>
                      <input
                        type="number"
                        min={0}
                        max={100_000}
                        step={1}
                        value={quantities[item.id] ?? item.quantity}
                        disabled={list.paymentPending}
                        onChange={(event) => setQuantity(item.id, Number(event.target.value))}
                        className="min-h-11 w-20 rounded-button border border-border bg-background px-2 text-right text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                      />
                      {onRequest ? (
                        <button
                          type="button"
                          disabled={requested || priceRequestBusyId === item.id}
                          onClick={() => requestPrice(item.id)}
                          className="min-h-11 w-28 shrink-0 rounded-button border border-accent bg-surface px-2 text-xs font-bold text-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {requested ? "Aangevraagd" : priceRequestBusyId === item.id ? "Bezig…" : "Vraag prijs aan"}
                        </button>
                      ) : (
                        <span className="w-24 shrink-0 text-right font-semibold text-text">{formatPrice((quantities[item.id] ?? item.quantity) * item.unitPriceCents!, "nl")}</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">Aantal 0 betekent: wel bewaren op mijn vaste lijst, niet meenemen in deze bestelling.</p>
            <div className="mt-6">
              <h3 className="font-heading font-bold text-text">
                {fixedPickupLocation ? `Afhaaldag bij ${fixedPickupLocation.name}` : "Voorkeursdag ophalen (optioneel)"}
              </h3>
              {fixedPickupLocation ? (
                <p className="mt-1 text-xs text-muted">
                  Je ziet alleen de afhaaldagen voor {fixedPickupLocation.name}{pickupFrequencyLabel ? `; afgesproken ritme: ${pickupFrequencyLabel}` : ""}.
                </p>
              ) : null}
              <div className="mt-2">
                <PickupDayCalendar
                  selectedDay={pickupDay}
                  onSelect={selectPickupDay}
                  disabled={pickupDayBusy}
                  fixedPickupLocationId={account.fixedPickupLocationId}
                />
              </div>
            </div>

            <div className="mt-5 space-y-1 border-t border-border pt-4 text-body-sm">
              <div className="flex items-center justify-between text-muted">
                <span>Subtotaal (excl. BTW)</span>
                <span>{formatPrice(liveTotalCents, "nl")}</span>
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

            <div className="mt-6 flex flex-wrap gap-3">
              {dirty ? (
                <button type="button" disabled={saving || list.paymentPending} onClick={saveQuantities} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-button border border-accent bg-surface px-5 font-heading font-bold text-accent-hover shadow-button disabled:opacity-60">
                  <Save className="h-5 w-5" aria-hidden="true" /> {saving ? "Bezig…" : "Wijzigingen opslaan"}
                </button>
              ) : (
                <button type="button" disabled={!payable || checkoutBusy} onClick={startCheckout} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                  {checkoutBusy
                    ? "Bezig…"
                    : hasUnresolvedPriceRequest
                      ? "Wacht op prijs van Fedor"
                      : liveTotalCents === 0
                        ? "Kies eerst een aantal"
                        : `Nu afrekenen — ${formatPrice(payableTotalCents, "nl")}`}
                </button>
              )}
            </div>
            {dirty ? <p className="mt-2 text-xs text-muted">Sla je wijzigingen op voordat je afrekent.</p> : null}
            {!dirty && hasUnresolvedPriceRequest ? (
              <p className="mt-2 text-xs text-muted">Voor minstens één gekozen product moet de prijs nog worden ingevuld.</p>
            ) : null}
            {saveError ? <p role="alert" className="mt-4 rounded-card bg-red-50 p-3 text-body-sm font-semibold text-red-700">{saveError}</p> : null}
            {checkoutError ? <p role="alert" className="mt-4 rounded-card bg-red-50 p-3 text-body-sm font-semibold text-red-700">{checkoutError}</p> : null}
          </>
        ) : null}
        {list.status === "SENT" && list.paymentPending ? (
          <p className="mt-2 flex items-center gap-2 rounded-card bg-background p-4 text-body-sm text-muted">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> We controleren je betaling nog even. Deze pagina werkt vanzelf bij zodra dat rond is.
          </p>
        ) : null}
        {list.status === "SENT" && expired && !list.paymentPending ? (
          <p className="mt-2 rounded-card bg-background p-4 text-body-sm text-muted">Deze bestellijst is verlopen. Vraag Fedor om een nieuwe versie.</p>
        ) : null}
        {list.status === "CANCELLED" ? (
          <p className="mt-2 rounded-card bg-background p-4 text-body-sm text-muted">Deze bestellijst is geannuleerd.</p>
        ) : null}

        {list.notes.length > 0 ? (
          <div className="mt-6">
            <BusinessPortalSection compact title="Notities" description={`${list.notes.length} ${list.notes.length === 1 ? "bericht" : "berichten"}`}>
              <ol className="grid gap-2">
                {list.notes.map((item) => (
                  <li key={item.id} className="rounded-card border border-border p-3 text-body-sm">
                    <div className="flex flex-wrap justify-between gap-2"><strong className="text-text">{item.authorName}</strong><time className="text-xs text-muted">{formatDateTime(item.createdAt)}</time></div>
                    <p className="mt-1 whitespace-pre-wrap text-muted">{item.text}</p>
                  </li>
                ))}
              </ol>
            </BusinessPortalSection>
          </div>
        ) : null}

        {list.orderHistory.length > 0 ? (
          <div className="mt-4">
            <BusinessPortalSection compact title="Eerdere bestellingen" description={`${list.orderHistory.length} ${list.orderHistory.length === 1 ? "bestelling" : "bestellingen"}`}>
              <div className="grid gap-3">
                {list.orderHistory.map((order) => <OrderHistoryEntry key={order.id} order={order} account={account} />)}
              </div>
            </BusinessPortalSection>
          </div>
        ) : null}
        </div>
      </details>
    </article>
  );
}

function OrderHistoryEntry({ order, account }: { order: PortalOrderHistoryEntry; account: PortalAccount }) {
  const router = useRouter();
  const [peppolBusy, setPeppolBusy] = useState(false);
  const [peppolResult, setPeppolResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationQuantities, setCancellationQuantities] = useState<Record<string, string>>({});
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [cancellationResult, setCancellationResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const activeRequestedByItem = useMemo(() => {
    const result = new Map<string, number>();
    for (const request of order.cancellationRequests) {
      if (request.status === "REJECTED") continue;
      for (const item of request.items) {
        result.set(item.orderItemId, (result.get(item.orderItemId) ?? 0) + item.quantity);
      }
    }
    return result;
  }, [order.cancellationRequests]);
  const cancellable = order.status === "PAID" || order.status === "FULFILLED";

  async function requestCancellation() {
    const items = order.items.flatMap((item) => {
      const quantity = Number(cancellationQuantities[item.id] || 0);
      return Number.isInteger(quantity) && quantity > 0 ? [{ orderItemId: item.id, quantity }] : [];
    });
    if (items.length === 0) {
      setCancellationResult({ type: "error", text: "Kies bij minimaal één product een aantal." });
      return;
    }
    setCancellationBusy(true);
    setCancellationResult(null);
    try {
      const response = await fetch(`/api/business/orders/${order.id}/cancellations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, reason: cancellationReason.trim() || null }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        const text = data?.error === "QUANTITY_EXCEEDS_REMAINING"
          ? "De bestelling is intussen gewijzigd. Controleer de actuele aantallen en probeer opnieuw."
          : data?.error === "ORDER_NOT_CANCELLABLE"
            ? "Deze bestelling kan niet meer via de portal worden geannuleerd. Neem contact op met Fedor."
            : "De annuleringsaanvraag kon niet worden opgeslagen. Probeer het opnieuw.";
        setCancellationResult({ type: "error", text });
        return;
      }
      setCancellationQuantities({});
      setCancellationReason("");
      setCancellationResult({ type: "ok", text: "Je aanvraag is ontvangen. De producten blijven op je vaste bestellijst staan." });
      router.refresh();
    } catch {
      setCancellationResult({ type: "error", text: "De verbinding viel weg. Probeer het opnieuw." });
    } finally {
      setCancellationBusy(false);
    }
  }

  async function sendPeppol() {
    setPeppolBusy(true);
    setPeppolResult(null);
    try {
      const response = await fetch(`/api/business/orders/${order.id}/peppol`, { method: "POST" });
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
    <details className="group/order-history rounded-card border border-border bg-background">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4 text-left outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <span className="text-body-sm text-text"><strong className="font-heading">{formatDate(order.date)}</strong> · {order.items.length} {order.items.length === 1 ? "product" : "producten"}</span>
        <span className="flex flex-wrap items-center justify-end gap-2 pl-2">
          <span className="rounded-button bg-surface px-2 py-1 text-xs font-bold text-muted">{orderStatusLabel(order.status)}</span>
          <span className="font-heading font-bold text-text">{formatPrice(order.totalCents, "nl")}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open/order-history:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-border px-4 pb-4">
          <ul className="mt-3 divide-y divide-border border-t border-border pt-2 text-body-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0"><strong className="block text-text">{item.productName}</strong><span className="text-muted">{item.variantLabel ?? "—"}</span></span>
                <span className="shrink-0 text-right text-muted">{item.quantity} × {formatPrice(item.unitPriceCents, "nl")}</span>
              </li>
            ))}
          </ul>
          {order.cancellationRequests.length > 0 ? (
            <div className="mt-3 grid gap-2" aria-label="Annuleringsaanvragen">
              {order.cancellationRequests.map((request) => {
                const quantity = request.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <div key={request.id} className="rounded-card border border-border bg-surface px-3 py-2 text-body-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-text">Annulering van {quantity} {quantity === 1 ? "artikel" : "artikelen"}</strong>
                      <span className="text-xs font-bold text-muted">{cancellationStatusLabel(request.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">Aangevraagd op {formatDateTime(request.createdAt)}</p>
                    {request.reason ? <p className="mt-1 whitespace-pre-wrap text-muted">{request.reason}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={`/api/business/orders/${order.id}/invoice`}
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
            {cancellable ? (
              <button
                type="button"
                onClick={() => setCancellationOpen((value) => !value)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text hover:border-border-hover sm:w-auto"
                aria-expanded={cancellationOpen}
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" /> Bestelling aanpassen of annuleren
              </button>
            ) : null}
          </div>
          {peppolResult ? (
            <p role={peppolResult.type === "error" ? "alert" : "status"} className={`mt-3 text-body-sm font-semibold ${peppolResult.type === "error" ? "text-red-700" : "text-green-700"}`}>
              {peppolResult.text}
            </p>
          ) : null}
          {cancellationOpen && cancellable ? (
            <div className="mt-4 rounded-card border border-border bg-surface p-4">
              <h4 className="font-heading font-bold text-text">Annulering aanvragen</h4>
              <p className="mt-1 text-body-sm text-muted">Kies per product wat je uit deze bestelling wilt annuleren. De vaste bestellijst verandert niet. Fedor controleert daarna het terug te betalen bedrag.</p>
              <div className="mt-4 grid gap-3">
                {order.items.map((item) => {
                  const requested = activeRequestedByItem.get(item.id) ?? 0;
                  const remaining = Math.max(0, item.quantity - requested);
                  return (
                    <label key={item.id} className="grid gap-2 rounded-card border border-border p-3 sm:grid-cols-[1fr_8rem] sm:items-center">
                      <span className="min-w-0 text-body-sm">
                        <strong className="block text-text">{item.productName}</strong>
                        <span className="text-muted">{item.variantLabel ?? "Variant"} · nog {remaining} annuleerbaar</span>
                      </span>
                      <span>
                        <span className="sr-only">Aantal van {item.productName}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={remaining}
                          step={1}
                          value={cancellationQuantities[item.id] ?? ""}
                          disabled={remaining === 0 || cancellationBusy}
                          onChange={(event) => setCancellationQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                          placeholder="0"
                          className="min-h-11 w-full rounded-button border border-border bg-background px-3 text-right text-base text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
              <label className="mt-4 block text-body-sm font-semibold text-text">
                Toelichting (optioneel)
                <textarea
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  maxLength={1_000}
                  rows={3}
                  disabled={cancellationBusy}
                  className="mt-2 w-full rounded-button border border-border bg-background px-3 py-2 text-base font-normal text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <button
                type="button"
                disabled={cancellationBusy}
                onClick={requestCancellation}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60 sm:w-auto"
              >
                {cancellationBusy ? "Aanvraag opslaan…" : "Annulering aanvragen"}
              </button>
            </div>
          ) : null}
          {cancellationResult ? (
            <p role={cancellationResult.type === "error" ? "alert" : "status"} className={`mt-3 text-body-sm font-semibold ${cancellationResult.type === "error" ? "text-red-700" : "text-green-700"}`}>
              {cancellationResult.text}
            </p>
          ) : null}
      </div>
    </details>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function orderStatusLabel(status: PortalOrderHistoryEntry["status"]) {
  return status === "PAID" ? "Betaald" : status === "FULFILLED" ? "Afgehandeld" : status === "REFUNDED" ? "Terugbetaald" : "Geannuleerd";
}
function cancellationStatusLabel(status: PortalCancellationRequest["status"]) {
  return status === "PENDING" ? "In behandeling" : status === "PROCESSED" ? "Verwerkt" : "Afgewezen";
}
