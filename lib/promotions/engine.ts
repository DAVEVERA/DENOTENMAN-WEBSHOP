import type { Locale } from "@/lib/i18n";
import {
  DEFAULT_BADGE,
  promotionBadgeSchema,
  variantPricesSchema,
  volumeTiersSchema,
  type PromotionBadge,
  type VolumeTier,
} from "./schema";

// Pure promotion engine: no database, no clock of its own. The checkout prices carts
// with priceCartWithPromotions; the storefront shows the same numbers through
// productPromotionView. Rules:
// - promotions do not stack with each other: per line the customer gets the lowest price;
// - volume tiers come on top of a price promotion only when it allows stacking,
//   otherwise the better of the two wins;
// - a promotion never raises a price and never goes below 1 cent; rounding is per unit.

export type PromotionKind = "PRICE" | "VOLUME" | "LOYALTY" | "LABEL";

export type PromotionRule = {
  id: string;
  name: string;
  kind: PromotionKind;
  priority: number;
  discountType: "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE" | null;
  discountValue: number | null;
  variantPrices: Record<string, number>;
  volumeTiers: VolumeTier[];
  volumeScope: "LINE" | "PRODUCT" | "PROMOTION";
  loyaltyMinOrders: number | null;
  newWithinDays: number | null;
  stackWithVolume: boolean;
  allowDiscountCodes: boolean;
  scope: "ALL" | "PRODUCTS" | "CATEGORIES";
  productIds: string[];
  categoryIds: string[];
  excludedProductIds: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  weekdays: number[];
  dailyStartMinute: number | null;
  dailyEndMinute: number | null;
  badge: PromotionBadge;
};

/** A Promotion row as Prisma returns it (Json columns untyped). */
export type PromotionRow = Omit<PromotionRule, "variantPrices" | "volumeTiers" | "volumeScope" | "badge" | "kind"> & {
  kind: string;
  status: string;
  variantPrices: unknown;
  volumeTiers: unknown;
  volumeScope: string | null;
  badge: unknown;
};

/** Turns a stored row into a rule; invalid JSON falls back to safe defaults. */
export function ruleFromRow(row: PromotionRow): PromotionRule {
  const tiers = volumeTiersSchema.safeParse(row.volumeTiers);
  const prices = variantPricesSchema.safeParse(row.variantPrices ?? {});
  const badge = promotionBadgeSchema.safeParse(row.badge);
  return {
    id: row.id,
    name: row.name,
    kind: (["PRICE", "VOLUME", "LOYALTY", "LABEL"].includes(row.kind) ? row.kind : "LABEL") as PromotionKind,
    priority: row.priority,
    discountType: row.discountType,
    discountValue: row.discountValue,
    variantPrices: prices.success ? prices.data : {},
    volumeTiers: tiers.success ? [...tiers.data].sort((a, b) => a.minQuantity - b.minQuantity) : [],
    volumeScope: row.volumeScope === "PRODUCT" || row.volumeScope === "PROMOTION" ? row.volumeScope : "LINE",
    loyaltyMinOrders: row.loyaltyMinOrders,
    newWithinDays: row.newWithinDays,
    stackWithVolume: row.stackWithVolume,
    allowDiscountCodes: row.allowDiscountCodes,
    scope: row.scope,
    productIds: row.productIds,
    categoryIds: row.categoryIds,
    excludedProductIds: row.excludedProductIds,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    weekdays: row.weekdays,
    dailyStartMinute: row.dailyStartMinute,
    dailyEndMinute: row.dailyEndMinute,
    badge: badge.success ? badge.data : DEFAULT_BADGE,
  };
}

// ---------- Time (Europe/Amsterdam) ----------

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function amsterdamClock(now: Date): { isoWeekday: number; minuteOfDay: number } {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map((part) => [part.type, part.value]));
  return { isoWeekday: WEEKDAYS[parts.weekday] ?? 1, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Whether the schedule of a promotion is running now (status is checked when loading). */
export function isPromotionLive(rule: Pick<PromotionRule, "startsAt" | "endsAt" | "weekdays" | "dailyStartMinute" | "dailyEndMinute">, now: Date): boolean {
  if (rule.startsAt && now < rule.startsAt) return false;
  if (rule.endsAt && now >= rule.endsAt) return false;
  if (!rule.weekdays.length && rule.dailyStartMinute === null) return true;
  const clock = amsterdamClock(now);
  if (rule.weekdays.length && !rule.weekdays.includes(clock.isoWeekday)) return false;
  if (rule.dailyStartMinute !== null && rule.dailyEndMinute !== null) {
    if (clock.minuteOfDay < rule.dailyStartMinute || clock.minuteOfDay >= rule.dailyEndMinute) return false;
  }
  return true;
}

// ---------- Matching ----------

export type ProductFacts = { productId: string; categoryIds: string[]; createdAt?: Date | null };

export function promotionMatchesProduct(rule: PromotionRule, product: ProductFacts, now?: Date): boolean {
  if (rule.excludedProductIds.includes(product.productId)) return false;
  const inScope = rule.scope === "ALL"
    || (rule.scope === "PRODUCTS" && rule.productIds.includes(product.productId))
    || (rule.scope === "CATEGORIES" && product.categoryIds.some((id) => rule.categoryIds.includes(id)));
  if (!inScope) return false;
  if (rule.kind === "LABEL" && rule.newWithinDays !== null) {
    if (!product.createdAt || !now) return false;
    return now.getTime() - product.createdAt.getTime() <= rule.newWithinDays * 86_400_000;
  }
  return true;
}

// ---------- Prices ----------

export type VariantFacts = { variantId: string; regularCents: number; saleCents: number | null };

function clampPrice(cents: number): number {
  return Math.max(1, Math.round(cents));
}

function percentOff(cents: number, percent: number): number {
  return clampPrice((cents * (100 - percent)) / 100);
}

/** The price a price or loyalty promotion gives a variant, from its regular price; null when it does not apply. */
export function promotionUnitPrice(rule: PromotionRule, variant: VariantFacts): number | null {
  if (rule.kind === "LOYALTY") return rule.discountValue ? percentOff(variant.regularCents, rule.discountValue) : null;
  if (rule.kind !== "PRICE" || !rule.discountType) return null;
  if (rule.discountType === "PERCENT") return rule.discountValue ? percentOff(variant.regularCents, Math.min(rule.discountValue, 90)) : null;
  if (rule.discountType === "AMOUNT_OFF") return rule.discountValue ? clampPrice(variant.regularCents - rule.discountValue) : null;
  const fixed = rule.variantPrices[variant.variantId] ?? rule.discountValue;
  return fixed ? clampPrice(fixed) : null;
}

export type BestPrice = {
  /** What the customer pays per unit before volume tiers. */
  unitCents: number;
  /** The variant's regular price, shown struck through when lower. */
  regularCents: number;
  rule: PromotionRule | null;
};

/** Lowest price among the variant's own sale price and every live price promotion that matches. */
export function bestPrice(
  rules: PromotionRule[],
  product: ProductFacts,
  variant: VariantFacts,
  now: Date,
  context: { paidOrders?: number | null } = {},
): BestPrice {
  const current = variant.saleCents !== null && variant.saleCents < variant.regularCents ? variant.saleCents : variant.regularCents;
  let best: BestPrice = { unitCents: current, regularCents: variant.regularCents, rule: null };
  for (const rule of rules) {
    if (rule.kind !== "PRICE" && rule.kind !== "LOYALTY") continue;
    if (rule.kind === "LOYALTY" && (context.paidOrders == null || rule.loyaltyMinOrders === null || context.paidOrders < rule.loyaltyMinOrders)) continue;
    if (!isPromotionLive(rule, now) || !promotionMatchesProduct(rule, product, now)) continue;
    const price = promotionUnitPrice(rule, variant);
    if (price === null || price >= best.unitCents) {
      // Equal prices: the higher priority keeps the label.
      if (price !== null && price === best.unitCents && best.rule && rule.priority > best.rule.priority) best = { ...best, rule };
      continue;
    }
    best = { unitCents: price, regularCents: variant.regularCents, rule };
  }
  return best;
}

/** The highest tier reached by a quantity, or null. */
export function tierFor(tiers: VolumeTier[], quantity: number): VolumeTier | null {
  let reached: VolumeTier | null = null;
  for (const tier of tiers) if (quantity >= tier.minQuantity && (!reached || tier.percentOff > reached.percentOff)) reached = tier;
  return reached;
}

export type CartLineFacts = ProductFacts & VariantFacts & { lineId: string; quantity: number };

export type PricedLine = {
  lineId: string;
  unitPriceCents: number;
  regularUnitPriceCents: number;
  promotionId: string | null;
  /** Short customer-facing description, e.g. "Actie! −20%" or "Stapelkorting 10%". */
  promotionLabel: string | null;
  volumePercent: number | null;
  /** False when an applied promotion excludes discount codes. */
  allowsDiscountCodes: boolean;
};

function badgeText(rule: PromotionRule, locale: Locale): string {
  return (rule.badge.text[locale] || rule.badge.text.nl || rule.name).trim();
}

const VOLUME_LABEL: Record<Locale, string> = { nl: "Stapelkorting", en: "Volume discount", fr: "Remise quantité" };
const GENERIC_LABEL: Record<Locale, string> = { nl: "Actieprijs", en: "Sale price", fr: "Prix promo" };

/** The line label in cart and checkout; a promotion can keep its label off there. */
function cartText(rule: PromotionRule, locale: Locale): string {
  return rule.badge.placements.cart ? badgeText(rule, locale) : GENERIC_LABEL[locale];
}

/** Prices every cart line. The checkout charges exactly these unit prices. */
export function priceCartWithPromotions(
  lines: CartLineFacts[],
  rules: PromotionRule[],
  now: Date,
  options: { locale?: Locale; paidOrders?: number | null } = {},
): PricedLine[] {
  const locale = options.locale ?? "nl";
  const volumeRules = rules.filter((rule) => rule.kind === "VOLUME" && rule.volumeTiers.length && isPromotionLive(rule, now));

  // Quantities per volume rule, grouped by its scope.
  const groupQuantity = new Map<string, number>();
  const groupKey = (rule: PromotionRule, line: CartLineFacts) =>
    `${rule.id}:${rule.volumeScope === "LINE" ? line.lineId : rule.volumeScope === "PRODUCT" ? line.productId : "all"}`;
  for (const rule of volumeRules) {
    for (const line of lines) {
      if (!promotionMatchesProduct(rule, line, now)) continue;
      const key = groupKey(rule, line);
      groupQuantity.set(key, (groupQuantity.get(key) ?? 0) + line.quantity);
    }
  }

  return lines.map((line) => {
    const action = bestPrice(rules, line, line, now, { paidOrders: options.paidOrders });
    let volume: { rule: PromotionRule; tier: VolumeTier } | null = null;
    for (const rule of volumeRules) {
      if (!promotionMatchesProduct(rule, line, now)) continue;
      const tier = tierFor(rule.volumeTiers, groupQuantity.get(groupKey(rule, line)) ?? 0);
      if (tier && (!volume || tier.percentOff > volume.tier.percentOff)) volume = { rule, tier };
    }

    let unit = action.unitCents;
    let promotionId = action.rule?.id ?? null;
    let label = action.rule ? cartText(action.rule, locale) : null;
    let volumePercent: number | null = null;
    const applied: PromotionRule[] = action.rule ? [action.rule] : [];

    if (volume) {
      const stacks = !action.rule || action.rule.stackWithVolume;
      const withoutAction = action.rule
        ? (line.saleCents !== null && line.saleCents < line.regularCents ? line.saleCents : line.regularCents)
        : action.unitCents;
      const volumeUnit = percentOff(stacks ? action.unitCents : withoutAction, volume.tier.percentOff);
      if (volumeUnit < unit) {
        const volumeLabel = `${VOLUME_LABEL[locale]} ${volume.tier.percentOff}%`;
        if (stacks && action.rule) {
          label = `${label} + ${volumeLabel}`;
          applied.push(volume.rule);
        } else {
          label = volumeLabel;
          promotionId = volume.rule.id;
          applied.splice(0, applied.length, volume.rule);
        }
        unit = volumeUnit;
        volumePercent = volume.tier.percentOff;
        promotionId ??= volume.rule.id;
      }
    }

    const discounted = unit < line.regularCents;
    return {
      lineId: line.lineId,
      unitPriceCents: unit,
      regularUnitPriceCents: line.regularCents,
      promotionId: discounted ? promotionId : null,
      promotionLabel: discounted ? label : null,
      volumePercent,
      allowsDiscountCodes: applied.every((rule) => rule.allowDiscountCodes),
    };
  });
}

// ---------- Storefront view ----------

export type BadgeView = {
  id: string;
  kind: PromotionKind;
  text: string;
  background: string;
  color: string;
  shape: PromotionBadge["shape"];
  position: PromotionBadge["position"];
  size: PromotionBadge["size"];
  /** Whole percentage shown next to the text, or null. */
  percentOff: number | null;
  /** ISO end date when the countdown should show, or null. */
  countdownEndsAt: string | null;
  placements: PromotionBadge["placements"];
};

export type ProductPromotionView = {
  badges: BadgeView[];
  /** Price per variant after promotions (before volume tiers). */
  variantPrices: Record<string, BestPrice & { promotionId: string | null }>;
  /** Volume tiers that apply to this product, highest priority first. */
  volumeTiers: Array<VolumeTier & { scope: PromotionRule["volumeScope"] }>;
};

const COUNTDOWN_WINDOW_MS = 7 * 86_400_000;

/** Labels, prices and tiers for one product on the storefront. At most two labels. */
export function productPromotionView(
  rules: PromotionRule[],
  product: ProductFacts,
  variants: VariantFacts[],
  now: Date,
  locale: Locale,
): ProductPromotionView {
  const live = rules.filter((rule) => isPromotionLive(rule, now) && promotionMatchesProduct(rule, product, now));
  const variantPrices: ProductPromotionView["variantPrices"] = {};
  for (const variant of variants) {
    const price = bestPrice(live, product, variant, now);
    variantPrices[variant.variantId] = { ...price, promotionId: price.rule?.id ?? null };
  }

  const badges: BadgeView[] = [];
  for (const rule of [...live].sort((a, b) => b.priority - a.priority)) {
    let percent: number | null = null;
    if (rule.kind === "PRICE") {
      // Only show a price label when it actually lowers a price; the percentage is the best saving.
      const savings = variants
        .map((variant) => variantPrices[variant.variantId])
        .filter((price) => price?.rule?.id === rule.id && price.unitCents < price.regularCents)
        .map((price) => Math.round(((price.regularCents - price.unitCents) / price.regularCents) * 100));
      if (!savings.length && variants.length) continue;
      percent = rule.badge.showPercent && savings.length ? Math.max(...savings) : null;
    }
    const endsSoon = rule.endsAt && rule.endsAt.getTime() - now.getTime() <= COUNTDOWN_WINDOW_MS;
    badges.push({
      id: rule.id,
      kind: rule.kind,
      text: badgeText(rule, locale),
      background: rule.badge.background,
      color: rule.badge.color,
      shape: rule.badge.shape,
      position: rule.badge.position,
      size: rule.badge.size,
      percentOff: percent && percent > 0 ? percent : null,
      countdownEndsAt: rule.badge.showCountdown && endsSoon && rule.endsAt ? rule.endsAt.toISOString() : null,
      placements: rule.badge.placements,
    });
    if (badges.length === 2) break;
  }

  const volumeTiers = live
    .filter((rule) => rule.kind === "VOLUME" && rule.volumeTiers.length)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 1)
    .flatMap((rule) => rule.volumeTiers.map((tier) => ({ ...tier, scope: rule.volumeScope })));

  return { badges, variantPrices, volumeTiers };
}

/** "Nog 3 dagen" / "Alleen vandaag" style countdown text, or null when far away or over. */
export function countdownText(endsAtIso: string, now: Date, locale: Locale): string | null {
  const remaining = new Date(endsAtIso).getTime() - now.getTime();
  if (remaining <= 0) return null;
  const hours = Math.ceil(remaining / 3_600_000);
  const days = Math.ceil(remaining / 86_400_000);
  const copy = {
    nl: { hours: (n: number) => `Nog ${n} uur`, today: "Alleen vandaag", days: (n: number) => `Nog ${n} dagen` },
    en: { hours: (n: number) => `${n}h left`, today: "Today only", days: (n: number) => `${n} days left` },
    fr: { hours: (n: number) => `Encore ${n} h`, today: "Aujourd’hui seulement", days: (n: number) => `Encore ${n} jours` },
  }[locale];
  if (hours <= 12) return copy.hours(hours);
  if (days <= 1) return copy.today;
  return copy.days(days);
}
