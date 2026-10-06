"use client";

/* eslint-disable @next/next/no-img-element -- product thumbnails come from the public bucket. */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, LoaderCircle, Plus, Search, Tag, Trash2, X } from "lucide-react";

import { PromotionBadges } from "@/components/product/PromotionBadges";
import { formatPrice } from "@/lib/format";
import { promotionUnitPrice, type BadgeView, type PromotionRule } from "@/lib/promotions/engine";
import {
  BADGE_POSITIONS,
  BADGE_PRESETS,
  BADGE_SHAPES,
  BADGE_SIZES,
  type PromotionBadge,
  type PromotionInput,
  type VolumeTier,
} from "@/lib/promotions/schema";
import { emptyPromotionInput } from "@/lib/promotions/defaults";

export type PromotionEditorProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  variants: Array<{ id: string; label: string; priceCents: number }>;
};
export type PromotionEditorCategory = { id: string; name: string };

const input = "min-h-11 w-full min-w-0 rounded-button border border-border bg-background px-3 py-2 text-base text-text";
const label = "grid gap-1 text-body-sm font-semibold text-text";
const chip = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-button border px-3 text-body-sm font-semibold";
const section = "grid min-w-0 gap-4 rounded-panel border border-border bg-surface p-4 shadow-card md:p-5";

const KINDS: Array<{ value: PromotionInput["kind"]; title: string; text: string }> = [
  { value: "PRICE", title: "Actieprijs", text: "Tijdelijk % korting, bedrag eraf of een vaste actieprijs." },
  { value: "VOLUME", title: "Stapelkorting", text: "Meer kopen, meer korting: staffels per aantal." },
  { value: "LOYALTY", title: "Vaste klantenkorting", text: "Korting voor klanten met eerdere bestellingen." },
  { value: "LABEL", title: "Alleen label", text: "Nieuw, Terug op voorraad, Laagste prijs garantie …" },
];

const WEEKDAYS = [["1", "ma"], ["2", "di"], ["3", "wo"], ["4", "do"], ["5", "vr"], ["6", "za"], ["7", "zo"]] as const;
const SWATCHES = ["#E0B200", "#141414", "#FFFFFF", "#596B2B", "#806600", "#B91C1C", "#F6F3EE", "#1F3A5F"];
const SHAPE_LABELS: Record<PromotionBadge["shape"], string> = { pill: "Pil", rounded: "Afgerond", square: "Recht", ribbon: "Vaandel", circle: "Rond" };
const SIZE_LABELS: Record<PromotionBadge["size"], string> = { sm: "Klein", md: "Middel", lg: "Groot" };
const POSITION_LABELS: Record<PromotionBadge["position"], string> = { "top-left": "Linksboven", "top-right": "Rechtsboven", "bottom-left": "Linksonder", "bottom-right": "Rechtsonder" };

// ---------- small helpers ----------

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function minutesToTime(minutes: number | null): string {
  if (minutes === null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function euroToCents(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function centsToEuro(cents: number | null | undefined): string {
  return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday 00:00 after the given date. */
function nextMonday(date: Date): Date {
  const day = date.getDay() || 7;
  return startOfDay(addDays(date, 8 - day));
}

function scheduleSummary(value: PromotionInput): string {
  const parts: string[] = [];
  const format = (iso: string) => new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  if (value.startsAt && value.endsAt) parts.push(`${format(value.startsAt)} t/m ${format(new Date(new Date(value.endsAt).getTime() - 60_000).toISOString())}`);
  else if (value.startsAt) parts.push(`vanaf ${format(value.startsAt)}`);
  else if (value.endsAt) parts.push(`tot ${format(value.endsAt)}`);
  else parts.push("zonder einddatum");
  if (value.weekdays.length) parts.push(`alleen op ${value.weekdays.map((day) => WEEKDAYS[day - 1][1]).join(", ")}`);
  if (value.dailyStartMinute !== null && value.dailyEndMinute !== null) parts.push(`${minutesToTime(value.dailyStartMinute)}–${minutesToTime(value.dailyEndMinute)}`);
  return parts.join(" · ");
}

// ---------- editor ----------

export function PromotionEditor({
  promotionId,
  initial,
  products,
  categories,
  canEdit,
}: {
  promotionId?: string;
  initial: PromotionInput;
  products: PromotionEditorProduct[];
  categories: PromotionEditorCategory[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<PromotionInput>(initial);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  // A fixed example end date for the countdown preview when none is set yet.
  const [previewEndsAt] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString());
  const [showFixedPerVariant, setShowFixedPerVariant] = useState(Boolean(initial.variantPrices && Object.keys(initial.variantPrices).length));

  const set = <K extends keyof PromotionInput>(key: K, next: PromotionInput[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setSaved(false);
  };
  const setBadge = (changes: Partial<PromotionBadge>) => set("badge", { ...value.badge, ...changes });

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedProducts = value.productIds.map((id) => productById.get(id)).filter((product): product is PromotionEditorProduct => Boolean(product));
  const matches = productQuery.trim()
    ? products.filter((product) => product.name.toLocaleLowerCase("nl-NL").includes(productQuery.trim().toLocaleLowerCase("nl-NL"))).slice(0, 12)
    : [];

  // Preview product: the first chosen product, or any product with a photo.
  const sample = selectedProducts[0] ?? products.find((product) => product.imageUrl) ?? products[0];
  const sampleVariant = sample?.variants[0];
  const previewRule: PromotionRule = {
    id: "preview", name: value.name, kind: value.kind, priority: value.priority, discountType: value.discountType, discountValue: value.discountValue,
    variantPrices: value.variantPrices ?? {}, volumeTiers: value.volumeTiers ?? [], volumeScope: value.volumeScope ?? "LINE",
    loyaltyMinOrders: value.loyaltyMinOrders, newWithinDays: value.newWithinDays, stackWithVolume: value.stackWithVolume,
    allowDiscountCodes: value.allowDiscountCodes, scope: value.scope, productIds: value.productIds, categoryIds: value.categoryIds,
    excludedProductIds: value.excludedProductIds, startsAt: null, endsAt: null, weekdays: [], dailyStartMinute: null, dailyEndMinute: null, badge: value.badge,
  };
  const previewPrice = sampleVariant ? promotionUnitPrice(previewRule, { variantId: sampleVariant.id, regularCents: sampleVariant.priceCents, saleCents: null }) : null;
  const previewPercent = sampleVariant && previewPrice !== null && previewPrice < sampleVariant.priceCents && value.kind === "PRICE"
    ? Math.round(((sampleVariant.priceCents - previewPrice) / sampleVariant.priceCents) * 100)
    : null;
  const previewBadge: BadgeView = {
    id: "preview", kind: value.kind, text: value.badge.text.nl || "Label", background: value.badge.background, color: value.badge.color,
    shape: value.badge.shape, position: value.badge.position, size: value.badge.size,
    percentOff: value.badge.showPercent && previewPercent ? previewPercent : null,
    countdownEndsAt: value.badge.showCountdown ? (value.endsAt ?? previewEndsAt) : null,
    placements: { card: true, detail: true, cart: true },
  };

  function toggleProduct(id: string) {
    set("productIds", value.productIds.includes(id) ? value.productIds.filter((other) => other !== id) : [...value.productIds, id]);
  }

  function applyKind(kind: PromotionInput["kind"]) {
    const fresh = emptyPromotionInput(kind, value.productIds);
    const preset = BADGE_PRESETS.find((item) => item.id === (kind === "VOLUME" ? "volume" : kind === "LOYALTY" ? "loyalty" : kind === "LABEL" ? "new" : "sale"));
    setValue((current) => ({
      ...fresh,
      name: current.name,
      status: current.status,
      priority: current.priority,
      scope: current.scope,
      productIds: current.productIds,
      categoryIds: current.categoryIds,
      excludedProductIds: current.excludedProductIds,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      weekdays: current.weekdays,
      dailyStartMinute: current.dailyStartMinute,
      dailyEndMinute: current.dailyEndMinute,
      badge: preset ? { ...current.badge, ...preset.badge, showPercent: kind === "PRICE" && (preset.badge.showPercent ?? true) } : current.badge,
    }));
    setSaved(false);
  }

  function quickSchedule(kind: "today" | "weekend" | "week" | "monday" | "everyWeekend" | "clear") {
    const now = new Date();
    if (kind === "clear") return setValue((current) => ({ ...current, startsAt: null, endsAt: null, weekdays: [], dailyStartMinute: null, dailyEndMinute: null }));
    if (kind === "everyWeekend") return setValue((current) => ({ ...current, startsAt: null, endsAt: null, weekdays: [6, 7] }));
    let start = startOfDay(now);
    let end = addDays(start, 1);
    if (kind === "weekend") {
      const day = now.getDay();
      start = day === 6 || day === 0 ? startOfDay(addDays(now, day === 0 ? -1 : 0)) : startOfDay(addDays(now, 6 - day));
      if (start < startOfDay(now)) start = startOfDay(now);
      end = nextMonday(start);
    }
    if (kind === "week") end = nextMonday(now);
    if (kind === "monday") {
      start = nextMonday(now);
      setValue((current) => ({ ...current, startsAt: start.toISOString(), endsAt: null, weekdays: [] }));
      return;
    }
    setValue((current) => ({ ...current, startsAt: start.toISOString(), endsAt: end.toISOString(), weekdays: [] }));
  }

  function setTier(index: number, changes: Partial<VolumeTier>) {
    set("volumeTiers", (value.volumeTiers ?? []).map((tier, position) => (position === index ? { ...tier, ...changes } : tier)));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const body: PromotionInput = {
        ...value,
        variantPrices: value.kind === "PRICE" && value.discountType === "FIXED_PRICE" && showFixedPerVariant ? value.variantPrices : null,
      };
      const response = await fetch(promotionId ? `/api/admin/promotions/${promotionId}` : "/api/admin/promotions", {
        method: promotionId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({})) as { promotion?: { id: string }; message?: string };
      if (!response.ok || !result.promotion) throw new Error(result.message || "Opslaan mislukt.");
      setSaved(true);
      if (!promotionId) router.push(`/admin/marketing/productacties/${result.promotion.id}`);
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!promotionId || !window.confirm(`Actie “${value.name}” definitief verwijderen? Gebruik liever "Gearchiveerd" als je hem later nog wilt zien.`)) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/admin/promotions/${promotionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Verwijderen mislukt.");
      router.push("/admin/marketing/productacties");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verwijderen mislukt.");
      setBusy(null);
    }
  }

  const isPrice = value.kind === "PRICE";

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <fieldset disabled={!canEdit || busy !== null} className="grid min-w-0 content-start gap-5 [&>*]:min-w-0">
        <section className={section} aria-labelledby="promo-kind">
          <h2 id="promo-kind" className="font-heading text-heading-sm font-bold text-text">1. Soort actie</h2>
          <label className={label}>Interne naam (alleen in de admin)
            <input required maxLength={120} value={value.name} onChange={(event) => set("name", event.target.value)} placeholder="Bv. Herfstactie cashew 20%" className={input} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Soort actie">
            {KINDS.map((kind) => (
              <button key={kind.value} type="button" role="radio" aria-checked={value.kind === kind.value} onClick={() => applyKind(kind.value)} className={`grid min-h-11 gap-1 rounded-card border p-3 text-left ${value.kind === kind.value ? "border-accent-ink bg-accent/10" : "border-border bg-background"}`}>
                <span className="font-heading text-body-sm font-bold text-text">{kind.title}</span>
                <span className="text-xs text-muted">{kind.text}</span>
              </button>
            ))}
          </div>
        </section>

        {value.kind !== "LABEL" ? (
          <section className={section} aria-labelledby="promo-discount">
            <h2 id="promo-discount" className="font-heading text-heading-sm font-bold text-text">2. Korting</h2>
            {isPrice ? (
              <>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Soort korting">
                  {([["PERCENT", "Percentage"], ["AMOUNT_OFF", "Bedrag eraf"], ["FIXED_PRICE", "Vaste actieprijs"]] as const).map(([type, text]) => (
                    <button key={type} type="button" role="radio" aria-checked={value.discountType === type} onClick={() => setValue((current) => ({ ...current, discountType: type, discountValue: type === "PERCENT" ? 15 : null }))} className={`${chip} ${value.discountType === type ? "border-accent-ink bg-accent/15" : "border-border bg-background"}`}>{text}</button>
                  ))}
                </div>
                {value.discountType === "PERCENT" ? (
                  <label className={label}>Korting in %
                    <span className="flex items-center gap-3">
                      <input type="range" min={1} max={90} value={value.discountValue ?? 15} onChange={(event) => set("discountValue", Number(event.target.value))} className="min-h-11 w-full accent-[color:var(--color-accent-ink,#806600)]" />
                      <input type="number" min={1} max={90} value={value.discountValue ?? ""} onChange={(event) => set("discountValue", event.target.value ? Number(event.target.value) : null)} className={`${input} w-24`} aria-label="Percentage" />
                    </span>
                  </label>
                ) : (
                  <label className={label}>{value.discountType === "AMOUNT_OFF" ? "Bedrag eraf per stuk (€)" : "Actieprijs per stuk (€), voor alle varianten"}
                    <input inputMode="decimal" value={centsToEuro(value.discountValue)} onChange={(event) => set("discountValue", euroToCents(event.target.value))} placeholder="bv. 4,95" className={input} />
                  </label>
                )}
                {value.discountType === "FIXED_PRICE" ? (
                  <div className="grid gap-2">
                    <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="checkbox" checked={showFixedPerVariant} onChange={(event) => setShowFixedPerVariant(event.target.checked)} />Per variant een eigen actieprijs</label>
                    {showFixedPerVariant ? (
                      selectedProducts.length ? (
                        <div className="grid gap-2 rounded-card border border-border bg-background p-3">
                          {selectedProducts.flatMap((product) => product.variants.map((variant) => (
                            <label key={variant.id} className="grid items-center gap-2 text-body-sm sm:grid-cols-[minmax(0,1fr)_8rem]">
                              <span className="min-w-0 truncate">{product.name} · {variant.label} <span className="text-muted">(nu {formatPrice(variant.priceCents, "nl")})</span></span>
                              <input inputMode="decimal" value={centsToEuro(value.variantPrices?.[variant.id])} onChange={(event) => {
                                const cents = euroToCents(event.target.value);
                                const next = { ...(value.variantPrices ?? {}) };
                                if (cents) next[variant.id] = cents; else delete next[variant.id];
                                set("variantPrices", next);
                              }} placeholder="Actieprijs" className={input} aria-label={`Actieprijs ${product.name} ${variant.label}`} />
                            </label>
                          )))}
                        </div>
                      ) : <p className="text-body-sm text-muted">Kies eerst producten onder 3. Producten.</p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {value.kind === "VOLUME" ? (
              <div className="grid gap-3">
                {(value.volumeTiers ?? []).map((tier, index) => (
                  <div key={index} className="grid items-end gap-2 rounded-card border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <label className={label}>Vanaf aantal stuks<input type="number" min={2} max={999} value={tier.minQuantity} onChange={(event) => setTier(index, { minQuantity: Number(event.target.value) })} className={input} /></label>
                    <label className={label}>Korting in %<input type="number" min={1} max={90} value={tier.percentOff} onChange={(event) => setTier(index, { percentOff: Number(event.target.value) })} className={input} /></label>
                    <button type="button" onClick={() => set("volumeTiers", (value.volumeTiers ?? []).filter((_, position) => position !== index))} disabled={(value.volumeTiers ?? []).length <= 1} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border text-red-700 disabled:opacity-40" aria-label={`Staffel ${index + 1} verwijderen`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                ))}
                {(value.volumeTiers ?? []).length < 8 ? <button type="button" onClick={() => { const last = value.volumeTiers?.at(-1); set("volumeTiers", [...(value.volumeTiers ?? []), { minQuantity: (last?.minQuantity ?? 2) + 3, percentOff: Math.min(90, (last?.percentOff ?? 5) + 5) }]); }} className={`${chip} justify-self-start border-border bg-background`}><Plus className="h-4 w-4" aria-hidden="true" />Staffel toevoegen</button> : null}
                <label className={label}>Hoe tellen de stuks?
                  <select value={value.volumeScope ?? "PRODUCT"} onChange={(event) => set("volumeScope", event.target.value as PromotionInput["volumeScope"])} className={input}>
                    <option value="PRODUCT">Per product: alle varianten (bv. 250 g en 500 g) samen</option>
                    <option value="LINE">Per variant: alleen dezelfde verpakking</option>
                    <option value="PROMOTION">Mix & match: alle producten uit deze actie samen</option>
                  </select>
                </label>
              </div>
            ) : null}

            {value.kind === "LOYALTY" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Korting in %<input type="number" min={1} max={90} value={value.discountValue ?? ""} onChange={(event) => set("discountValue", event.target.value ? Number(event.target.value) : null)} className={input} /></label>
                <label className={label}>Vanaf hoeveel eerdere bestellingen<input type="number" min={1} max={100} value={value.loyaltyMinOrders ?? ""} onChange={(event) => set("loyaltyMinOrders", event.target.value ? Number(event.target.value) : null)} className={input} /></label>
                <p className="text-xs text-muted sm:col-span-2">De klant wordt bij het afrekenen herkend aan het e-mailadres. Het label op de productkaart is informatief; de korting verschijnt in de checkout.</p>
              </div>
            ) : null}

            <div className="grid gap-1 border-t border-border pt-3">
              {value.kind !== "VOLUME" ? <label className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.stackWithVolume} onChange={(event) => set("stackWithVolume", event.target.checked)} />Stapelkorting komt hier nog bovenop</label> : null}
              <label className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.allowDiscountCodes} onChange={(event) => set("allowDiscountCodes", event.target.checked)} />Kortingscodes blijven geldig op deze producten</label>
              <p className="text-xs text-muted">Acties stapelen niet onderling: de klant krijgt per product altijd de laagste prijs.</p>
            </div>
          </section>
        ) : (
          <section className={section} aria-labelledby="promo-label-rule">
            <h2 id="promo-label-rule" className="font-heading text-heading-sm font-bold text-text">2. Wanneer tonen</h2>
            <label className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.newWithinDays !== null} onChange={(event) => set("newWithinDays", event.target.checked ? 30 : null)} />Automatisch op nieuwe producten</label>
            {value.newWithinDays !== null ? (
              <label className={label}>Producten die korter dan zoveel dagen in de shop staan
                <input type="number" min={1} max={365} value={value.newWithinDays} onChange={(event) => set("newWithinDays", Number(event.target.value) || 1)} className={`${input} max-w-40`} />
              </label>
            ) : <p className="text-xs text-muted">Het label staat op de producten die je hieronder kiest, bijvoorbeeld &quot;Terug op voorraad&quot; of &quot;Laagste prijs garantie&quot;.</p>}
          </section>
        )}

        <section className={section} aria-labelledby="promo-products">
          <h2 id="promo-products" className="font-heading text-heading-sm font-bold text-text">3. Producten</h2>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Voor welke producten">
            {([["PRODUCTS", "Gekozen producten"], ["CATEGORIES", "Categorieën"], ["ALL", "Alle producten"]] as const).map(([scope, text]) => (
              <button key={scope} type="button" role="radio" aria-checked={value.scope === scope} onClick={() => set("scope", scope)} className={`${chip} ${value.scope === scope ? "border-accent-ink bg-accent/15" : "border-border bg-background"}`}>{text}</button>
            ))}
          </div>
          {value.scope === "PRODUCTS" ? (
            <div className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
                <input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Zoek een product" aria-label="Product zoeken" className={`${input} pl-9`} />
              </div>
              {matches.length ? (
                <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-card border border-border p-1">
                  {matches.map((product) => {
                    const chosen = value.productIds.includes(product.id);
                    return (
                      <li key={product.id}>
                        <button type="button" onClick={() => toggleProduct(product.id)} className="flex min-h-11 w-full items-center gap-2 rounded-button p-2 text-left text-body-sm hover:bg-background">
                          {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-background" />}
                          <span className="min-w-0 flex-1 truncate">{product.name}</span>
                          {chosen ? <Check className="h-4 w-4 text-accent-ink" aria-label="Gekozen" /> : <Plus className="h-4 w-4 text-muted" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {selectedProducts.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Gekozen producten">
                  {selectedProducts.map((product) => (
                    <li key={product.id} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-body-sm">
                      {product.name}
                      <button type="button" onClick={() => toggleProduct(product.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface" aria-label={`${product.name} weghalen`}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-body-sm text-muted">Nog geen producten gekozen.</p>}
            </div>
          ) : null}
          {value.scope === "CATEGORIES" ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {categories.map((category) => (
                <label key={category.id} className="flex min-h-11 items-center gap-2 rounded-button border border-border bg-background px-3 text-body-sm">
                  <input type="checkbox" checked={value.categoryIds.includes(category.id)} onChange={(event) => set("categoryIds", event.target.checked ? [...value.categoryIds, category.id] : value.categoryIds.filter((id) => id !== category.id))} />
                  {category.name}
                </label>
              ))}
            </div>
          ) : null}
          {value.scope !== "PRODUCTS" && value.excludedProductIds.length ? (
            <p className="text-xs text-muted">Uitgesloten: {value.excludedProductIds.map((id) => productById.get(id)?.name ?? id).join(", ")}. Zet een product terug via het vinkje op de productpagina.</p>
          ) : null}
        </section>

        <section className={section} aria-labelledby="promo-schedule">
          <h2 id="promo-schedule" className="flex items-center gap-2 font-heading text-heading-sm font-bold text-text"><CalendarDays className="h-5 w-5 text-accent-ink" aria-hidden="true" />4. Planning</h2>
          <div className="flex flex-wrap gap-2">
            {([["today", "Alleen vandaag"], ["weekend", "Dit weekend"], ["week", "Deze week"], ["monday", "Vanaf maandag"], ["everyWeekend", "Elk weekend"], ["clear", "Altijd"]] as const).map(([kind, text]) => (
              <button key={kind} type="button" onClick={() => quickSchedule(kind)} className={`${chip} border-border bg-background`}>{text}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Start<input type="datetime-local" value={toLocalInput(value.startsAt)} onChange={(event) => set("startsAt", fromLocalInput(event.target.value))} className={input} /></label>
            <label className={label}>Einde (tot dit moment)<input type="datetime-local" value={toLocalInput(value.endsAt)} onChange={(event) => set("endsAt", fromLocalInput(event.target.value))} className={input} /></label>
          </div>
          <fieldset className="grid gap-1">
            <legend className="text-body-sm font-semibold text-text">Alleen op deze dagen (leeg = elke dag)</legend>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map(([day, text]) => {
                const number = Number(day);
                const active = value.weekdays.includes(number);
                return <button key={day} type="button" aria-pressed={active} onClick={() => set("weekdays", active ? value.weekdays.filter((other) => other !== number) : [...value.weekdays, number])} className={`${chip} w-12 ${active ? "border-accent-ink bg-accent/15" : "border-border bg-background"}`}>{text}</button>;
              })}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Dagelijks vanaf (optioneel)<input type="time" value={minutesToTime(value.dailyStartMinute)} onChange={(event) => set("dailyStartMinute", timeToMinutes(event.target.value))} className={input} /></label>
            <label className={label}>Dagelijks tot<input type="time" value={minutesToTime(value.dailyEndMinute)} onChange={(event) => set("dailyEndMinute", timeToMinutes(event.target.value))} className={input} /></label>
          </div>
          <p className="rounded-card bg-background p-3 text-body-sm text-text">{scheduleSummary(value)} <span className="text-muted">(Nederlandse tijd)</span></p>
        </section>

        <section className={section} aria-labelledby="promo-badge">
          <h2 id="promo-badge" className="flex items-center gap-2 font-heading text-heading-sm font-bold text-text"><Tag className="h-5 w-5 text-accent-ink" aria-hidden="true" />5. Label</h2>
          <div className="flex flex-wrap gap-2" aria-label="Voorbeeldteksten">
            {BADGE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setBadge({ ...preset.badge, showPercent: isPrice && (preset.badge.showPercent ?? value.badge.showPercent) })} className={`${chip} min-h-9 border-border px-2.5 text-xs`} style={{ background: preset.badge.background, color: preset.badge.color }}>{preset.label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>Tekst (NL)<input required maxLength={32} value={value.badge.text.nl} onChange={(event) => setBadge({ text: { ...value.badge.text, nl: event.target.value } })} className={input} /></label>
            <label className={label}>Engels<input maxLength={32} value={value.badge.text.en} onChange={(event) => setBadge({ text: { ...value.badge.text, en: event.target.value } })} placeholder={value.badge.text.nl} className={input} /></label>
            <label className={label}>Frans<input maxLength={32} value={value.badge.text.fr} onChange={(event) => setBadge({ text: { ...value.badge.text, fr: event.target.value } })} placeholder={value.badge.text.nl} className={input} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["background", "Achtergrond"], ["color", "Tekstkleur"]] as const).map(([key, text]) => (
              <div key={key} className="grid gap-1">
                <span className="text-body-sm font-semibold text-text">{text}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SWATCHES.map((swatch) => <button key={swatch} type="button" onClick={() => setBadge({ [key]: swatch })} aria-label={`${text} ${swatch}`} aria-pressed={value.badge[key].toUpperCase() === swatch} className={`h-9 w-9 rounded-full border-2 ${value.badge[key].toUpperCase() === swatch ? "border-accent-ink" : "border-border"}`} style={{ background: swatch }} />)}
                  <input type="color" value={value.badge[key]} onChange={(event) => setBadge({ [key]: event.target.value })} className="h-9 w-12 rounded-button border border-border" aria-label={`${text} eigen kleur`} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>Vorm<select value={value.badge.shape} onChange={(event) => setBadge({ shape: event.target.value as PromotionBadge["shape"] })} className={input}>{BADGE_SHAPES.map((shape) => <option key={shape} value={shape}>{SHAPE_LABELS[shape]}</option>)}</select></label>
            <label className={label}>Grootte<select value={value.badge.size} onChange={(event) => setBadge({ size: event.target.value as PromotionBadge["size"] })} className={input}>{BADGE_SIZES.map((size) => <option key={size} value={size}>{SIZE_LABELS[size]}</option>)}</select></label>
            <fieldset className="grid gap-1">
              <legend className="text-body-sm font-semibold text-text">Plaats op de kaart</legend>
              <div className="grid grid-cols-2 gap-1">
                {BADGE_POSITIONS.map((position) => <button key={position} type="button" aria-pressed={value.badge.position === position} onClick={() => setBadge({ position })} className={`${chip} min-h-9 px-1 text-xs ${value.badge.position === position ? "border-accent-ink bg-accent/15" : "border-border bg-background"}`}>{POSITION_LABELS[position]}</button>)}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {isPrice ? <label className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.badge.showPercent} onChange={(event) => setBadge({ showPercent: event.target.checked })} />Kortingspercentage tonen (−20%)</label> : null}
            <label className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.badge.showCountdown} onChange={(event) => setBadge({ showCountdown: event.target.checked })} />Afteller tonen in de laatste week</label>
          </div>
          <fieldset className="grid gap-1">
            <legend className="text-body-sm font-semibold text-text">Waar tonen</legend>
            <div className="flex flex-wrap gap-x-4">
              {([["card", "Productkaart"], ["detail", "Productpagina en snel bestellen"], ["cart", "Actienaam in winkelwagen en checkout"]] as const).map(([key, text]) => (
                <label key={key} className="flex min-h-11 items-center gap-2 text-body-sm"><input type="checkbox" checked={value.badge.placements[key]} onChange={(event) => setBadge({ placements: { ...value.badge.placements, [key]: event.target.checked } })} />{text}</label>
              ))}
            </div>
          </fieldset>
        </section>
      </fieldset>

      <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-20 xl:self-start" aria-label="Voorbeeld en opslaan">
        <section className={section}>
          <h2 className="font-heading text-heading-sm font-bold text-text">Voorbeeld</h2>
          <div className="mx-auto w-full max-w-[15rem] rounded-card border border-border bg-surface p-3 shadow-card">
            <span className="relative block">
              <span className="relative block aspect-square w-full overflow-hidden rounded-full border border-border bg-background">
                {sample?.imageUrl ? <img src={sample.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <PromotionBadges badges={[previewBadge]} placement="card" locale="nl" />
            </span>
            <p className="mt-3 line-clamp-2 font-heading text-body-sm font-semibold text-text">{sample?.name ?? "Productnaam"}</p>
            {sampleVariant ? (
              <p className="mt-2 border-t border-border pt-2 text-body-sm">
                {previewPrice !== null && previewPrice < sampleVariant.priceCents ? (
                  <>
                    <span className="block text-xs text-muted line-through">{formatPrice(sampleVariant.priceCents, "nl")}</span>
                    <span className="font-semibold text-red-700">{formatPrice(previewPrice, "nl")}</span>
                  </>
                ) : <span className="font-semibold">{formatPrice(sampleVariant.priceCents, "nl")}</span>}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1 rounded-card bg-background p-3">
            <span className="text-xs text-muted">Op de productpagina</span>
            <PromotionBadges badges={[previewBadge]} placement="detail" locale="nl" />
          </div>
        </section>

        <section className={section}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className={label}>Status
              <select value={value.status} onChange={(event) => set("status", event.target.value as PromotionInput["status"])} disabled={!canEdit} className={input}>
                <option value="DRAFT">Concept (niet zichtbaar)</option>
                <option value="ACTIVE">Actief (volgens planning)</option>
                <option value="PAUSED">Gepauzeerd</option>
                <option value="ARCHIVED">Gearchiveerd</option>
              </select>
            </label>
            <label className={label}>Prioriteit (0–100, hoger wint bij labels)
              <input type="number" min={0} max={100} value={value.priority} onChange={(event) => set("priority", Number(event.target.value) || 0)} disabled={!canEdit} className={input} />
            </label>
          </div>
          {error ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-800">{error}</p> : null}
          {saved ? <p role="status" className="rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800">Opgeslagen. Wijzigingen staan binnen een halve minuut in de shop.</p> : null}
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy !== null} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">
                {busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{promotionId ? "Opslaan" : "Actie aanmaken"}
              </button>
              {promotionId ? <button type="button" onClick={() => void remove()} disabled={busy !== null} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border px-4 text-body-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" />Verwijderen</button> : null}
            </div>
          ) : <p className="text-body-sm text-muted">Alleen een owner of admin kan acties wijzigen.</p>}
        </section>
      </aside>
    </form>
  );
}
