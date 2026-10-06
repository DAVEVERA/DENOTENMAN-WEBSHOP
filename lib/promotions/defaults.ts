import { DEFAULT_BADGE, type PromotionInput } from "./schema";

// Starting values for a new promotion. Kept out of the client editor so server pages
// (such as /admin/marketing/productacties/nieuw) can call it too.

export function emptyPromotionInput(kind: PromotionInput["kind"] = "PRICE", productIds: string[] = []): PromotionInput {
  return {
    name: "",
    kind,
    status: "DRAFT",
    priority: 10,
    discountType: kind === "PRICE" ? "PERCENT" : null,
    discountValue: kind === "PRICE" ? 15 : kind === "LOYALTY" ? 5 : null,
    variantPrices: null,
    volumeTiers: kind === "VOLUME" ? [{ minQuantity: 3, percentOff: 5 }, { minQuantity: 6, percentOff: 10 }] : null,
    volumeScope: kind === "VOLUME" ? "PRODUCT" : null,
    loyaltyMinOrders: kind === "LOYALTY" ? 3 : null,
    newWithinDays: null,
    stackWithVolume: false,
    allowDiscountCodes: true,
    scope: productIds.length ? "PRODUCTS" : "ALL",
    productIds,
    categoryIds: [],
    excludedProductIds: [],
    startsAt: null,
    endsAt: null,
    weekdays: [],
    dailyStartMinute: null,
    dailyEndMinute: null,
    badge: DEFAULT_BADGE,
  };
}
