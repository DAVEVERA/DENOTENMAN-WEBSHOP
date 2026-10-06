import { z } from "zod";

// Shapes for product promotions: the label styling stored in Promotion.badge, volume
// tiers, and the admin input. Shared by the engine, the storefront and the admin.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Gebruik een kleur als #RRGGBB.");
const labelText = z.string().trim().max(32, "Houd het label kort: maximaal 32 tekens.");

export const BADGE_SHAPES = ["pill", "rounded", "square", "ribbon", "circle"] as const;
export const BADGE_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export const BADGE_SIZES = ["sm", "md", "lg"] as const;

export const promotionBadgeSchema = z.object({
  text: z.object({
    nl: labelText.min(1, "Geef het label een tekst."),
    en: labelText.default(""),
    fr: labelText.default(""),
  }).strict(),
  background: hex,
  color: hex,
  shape: z.enum(BADGE_SHAPES),
  position: z.enum(BADGE_POSITIONS),
  size: z.enum(BADGE_SIZES),
  /** Adds the discount, e.g. "Actie! −20%". Only for price promotions. */
  showPercent: z.boolean(),
  /** Adds "Nog 2 dagen" / "Alleen vandaag" while the end date is near. */
  showCountdown: z.boolean(),
  placements: z.object({
    card: z.boolean(),
    detail: z.boolean(),
    cart: z.boolean(),
  }).strict(),
}).strict();

export type PromotionBadge = z.infer<typeof promotionBadgeSchema>;

export const DEFAULT_BADGE: PromotionBadge = {
  text: { nl: "Actie!", en: "Sale!", fr: "Promo !" },
  background: "#E0B200",
  color: "#141414",
  shape: "pill",
  position: "top-left",
  size: "md",
  showPercent: true,
  showCountdown: false,
  placements: { card: true, detail: true, cart: true },
};

export const volumeTierSchema = z.object({
  minQuantity: z.number().int().min(2, "Een staffel begint bij 2 stuks of meer.").max(999),
  percentOff: z.number().int().min(1).max(90),
}).strict();

export type VolumeTier = z.infer<typeof volumeTierSchema>;

export const volumeTiersSchema = z.array(volumeTierSchema).min(1).max(8)
  .refine((tiers) => new Set(tiers.map((tier) => tier.minQuantity)).size === tiers.length, "Elke staffel heeft een eigen aantal.");

export const variantPricesSchema = z.record(z.string().min(1).max(40), z.number().int().min(1).max(10_000_000));

const minuteOfDay = z.number().int().min(0).max(1440);

/** What the admin sends when saving a promotion. Kind-specific rules are checked below. */
export const promotionInputSchema = z.object({
  name: z.string().trim().min(1, "Geef de actie een interne naam.").max(120),
  kind: z.enum(["PRICE", "VOLUME", "LOYALTY", "LABEL"]),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]),
  priority: z.number().int().min(0).max(100),
  discountType: z.enum(["PERCENT", "AMOUNT_OFF", "FIXED_PRICE"]).nullable(),
  discountValue: z.number().int().min(1).max(10_000_000).nullable(),
  variantPrices: variantPricesSchema.nullable(),
  volumeTiers: volumeTiersSchema.nullable(),
  volumeScope: z.enum(["LINE", "PRODUCT", "PROMOTION"]).nullable(),
  loyaltyMinOrders: z.number().int().min(1).max(100).nullable(),
  newWithinDays: z.number().int().min(1).max(365).nullable(),
  stackWithVolume: z.boolean(),
  allowDiscountCodes: z.boolean(),
  scope: z.enum(["ALL", "PRODUCTS", "CATEGORIES"]),
  productIds: z.array(z.string().min(1).max(40)).max(2_000),
  categoryIds: z.array(z.string().min(1).max(40)).max(500),
  excludedProductIds: z.array(z.string().min(1).max(40)).max(2_000),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7),
  dailyStartMinute: minuteOfDay.nullable(),
  dailyEndMinute: minuteOfDay.nullable(),
  badge: promotionBadgeSchema,
}).strict().superRefine((input, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) issue("endsAt", "De einddatum ligt na de startdatum.");
  if ((input.dailyStartMinute === null) !== (input.dailyEndMinute === null)) issue("dailyEndMinute", "Vul zowel een begin- als eindtijd in, of geen van beide.");
  if (input.dailyStartMinute !== null && input.dailyEndMinute !== null && input.dailyEndMinute <= input.dailyStartMinute) issue("dailyEndMinute", "De eindtijd ligt na de begintijd.");
  if (input.scope === "PRODUCTS" && !input.productIds.length) issue("productIds", "Kies ten minste één product.");
  if (input.scope === "CATEGORIES" && !input.categoryIds.length) issue("categoryIds", "Kies ten minste één categorie.");
  if (input.kind === "PRICE") {
    if (!input.discountType) issue("discountType", "Kies hoe de korting werkt.");
    if (input.discountType === "PERCENT" && (input.discountValue === null || input.discountValue > 90)) issue("discountValue", "Kies een percentage tussen 1 en 90.");
    if (input.discountType === "AMOUNT_OFF" && input.discountValue === null) issue("discountValue", "Vul het bedrag in dat eraf gaat.");
    if (input.discountType === "FIXED_PRICE" && input.discountValue === null && !Object.keys(input.variantPrices ?? {}).length) issue("discountValue", "Vul een actieprijs in, voor alles of per variant.");
  }
  if (input.kind === "VOLUME" && !input.volumeTiers?.length) issue("volumeTiers", "Voeg ten minste één staffel toe.");
  if (input.kind === "LOYALTY") {
    if (input.loyaltyMinOrders === null) issue("loyaltyMinOrders", "Vanaf hoeveel eerdere bestellingen telt iemand als vaste klant?");
    if (input.discountValue === null || input.discountValue > 90) issue("discountValue", "Kies een percentage tussen 1 en 90.");
  }
});

export type PromotionInput = z.infer<typeof promotionInputSchema>;

/** Label presets the admin can start from; text stays editable. */
export const BADGE_PRESETS: Array<{ id: string; label: string; badge: Partial<PromotionBadge> & { text: PromotionBadge["text"] } }> = [
  { id: "sale", label: "Actie!", badge: { text: { nl: "Actie!", en: "Sale!", fr: "Promo !" }, background: "#E0B200", color: "#141414", showPercent: true } },
  { id: "offer", label: "Aanbieding!", badge: { text: { nl: "Aanbieding!", en: "Offer!", fr: "Offre !" }, background: "#E0B200", color: "#141414", showPercent: true } },
  { id: "week", label: "Alleen deze week!", badge: { text: { nl: "Alleen deze week!", en: "This week only!", fr: "Cette semaine seulement !" }, background: "#E0B200", color: "#141414", showCountdown: true } },
  { id: "today", label: "Alleen vandaag", badge: { text: { nl: "Alleen vandaag", en: "Today only", fr: "Aujourd’hui seulement" }, background: "#141414", color: "#E0B200", showCountdown: false } },
  { id: "weekend", label: "Alleen dit weekend", badge: { text: { nl: "Alleen dit weekend", en: "This weekend only", fr: "Ce week-end seulement" }, background: "#E0B200", color: "#141414" } },
  { id: "monday", label: "Vanaf maandag", badge: { text: { nl: "Vanaf maandag", en: "From Monday", fr: "Dès lundi" }, background: "#F6F3EE", color: "#141414" } },
  { id: "guarantee", label: "Laagste prijs garantie", badge: { text: { nl: "Laagste prijs garantie", en: "Lowest price guarantee", fr: "Prix le plus bas garanti" }, background: "#141414", color: "#FFFFFF", showPercent: false } },
  { id: "new", label: "Nieuw", badge: { text: { nl: "Nieuw", en: "New", fr: "Nouveau" }, background: "#596B2B", color: "#FFFFFF", showPercent: false } },
  { id: "back", label: "Terug op voorraad", badge: { text: { nl: "Terug op voorraad", en: "Back in stock", fr: "De retour en stock" }, background: "#596B2B", color: "#FFFFFF", showPercent: false } },
  { id: "volume", label: "Stapelkorting", badge: { text: { nl: "Stapelkorting", en: "Buy more, save more", fr: "Remise par quantité" }, background: "#E0B200", color: "#141414", showPercent: false } },
  { id: "loyalty", label: "Vaste klantenkorting", badge: { text: { nl: "Vaste klantenkorting", en: "Loyalty discount", fr: "Remise fidélité" }, background: "#806600", color: "#FFFFFF", showPercent: false } },
];
