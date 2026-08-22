import type { CartItem } from "@/lib/storefront-state";

export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-5YW8C6Y7F4";
export const GOOGLE_ANALYTICS_READY_EVENT = "denotenman-google-analytics-ready";

export type GoogleAnalyticsItem = {
  item_id: string;
  item_name: string;
  affiliation: "De Notenman";
  item_variant?: string;
  discount?: number;
  price: number;
  quantity: number;
};

export type GoogleAnalyticsPurchase = {
  transaction_id: string;
  value: number;
  currency: string;
  shipping: number;
  coupon?: string;
  items: GoogleAnalyticsItem[];
};

type PurchaseOrder = {
  id: string;
  currency: string;
  subtotalCents: number;
  discountCode: string | null;
  discountCents: number;
  shippingCents: number;
  items: Array<{
    variantId: string;
    productName: string;
    variantLabel: string;
    unitPriceCents: number;
    quantity: number;
  }>;
};

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      parameters: Record<string, unknown>
    ) => void;
    __denotenmanGoogleAnalyticsReady?: boolean;
  }
}

function euros(cents: number): number {
  return Math.round(cents) / 100;
}

function preciseEuros(cents: number): number {
  return Number((cents / 100).toFixed(6));
}

export function buildGoogleAnalyticsPurchase(order: PurchaseOrder): GoogleAnalyticsPurchase {
  const purchase: GoogleAnalyticsPurchase = {
    transaction_id: order.id,
    // GA4 purchase value is merchandise revenue after discount; shipping is
    // reported separately and must not be added to value.
    value: euros(Math.max(0, order.subtotalCents - order.discountCents)),
    currency: order.currency.toUpperCase(),
    shipping: euros(order.shippingCents),
    items: order.items.map((item) => {
      const unitDiscountCents =
        order.discountCents > 0 && order.subtotalCents > 0
          ? (order.discountCents * item.unitPriceCents) / order.subtotalCents
          : 0;

      return {
        item_id: item.variantId,
        item_name: item.productName,
        affiliation: "De Notenman",
        ...(item.variantLabel ? { item_variant: item.variantLabel } : {}),
        ...(unitDiscountCents > 0 ? { discount: preciseEuros(unitDiscountCents) } : {}),
        price: preciseEuros(Math.max(0, item.unitPriceCents - unitDiscountCents)),
        quantity: item.quantity,
      };
    }),
  };

  if (order.discountCode) {
    purchase.coupon = order.discountCode;
  }

  return purchase;
}

export function cartToGoogleAnalyticsItems(cart: CartItem[]): GoogleAnalyticsItem[] {
  return cart.map((item) => ({
    item_id: item.variantId,
    item_name: item.name,
    affiliation: "De Notenman",
    ...(item.variantLabel ? { item_variant: item.variantLabel } : {}),
    price: euros(item.priceCents),
    quantity: item.quantity,
  }));
}

export function isMollieReferrer(referrer: string): boolean {
  if (!referrer) return false;

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    return hostname === "mollie.com" || hostname.endsWith(".mollie.com");
  } catch {
    return false;
  }
}

export function sendGoogleAnalyticsEvent(
  eventName: string,
  parameters: Record<string, unknown>
): boolean {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return false;
  }

  const eventParameters = isMollieReferrer(document.referrer)
    ? { ...parameters, ignore_referrer: true }
    : parameters;

  window.gtag("event", eventName, eventParameters);
  return true;
}
