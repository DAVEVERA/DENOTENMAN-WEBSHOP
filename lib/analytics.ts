import type { CartItem } from "@/lib/storefront-state";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  parseCookieConsent,
} from "@/lib/cookie-consent";

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
    gtag?: (...args: unknown[]) => void;
    __denotenmanGoogleAnalyticsReady?: boolean;
  }
}

export type RoutePageTitleContext = {
  currentTitle: string;
  previousDocumentTitle: string | null;
  pathChanged: boolean;
  dialogHeading?: string;
  pageHeading?: string;
  pathname: string;
};

export function canonicalizeBrowserRoute(pathname: string, query: string): string {
  const canonicalQuery = new URLSearchParams(query).toString();
  return `${pathname}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
}

export function resolveRoutePageTitle({
  currentTitle,
  previousDocumentTitle,
  pathChanged,
  dialogHeading,
  pageHeading,
  pathname,
}: RoutePageTitleContext): string {
  const heading = dialogHeading || pageHeading;
  if (pathChanged && heading) return `${heading} | De Notenman`;

  const titleIsFromPreviousPath =
    pathChanged &&
    previousDocumentTitle !== null &&
    currentTitle === previousDocumentTitle;

  if (!titleIsFromPreviousPath && currentTitle) return currentTitle;

  return heading ? `${heading} | De Notenman` : pathname;
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

export function hasCurrentAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(
      parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))?.analytics
    );
  } catch {
    return false;
  }
}

export function denyGoogleAnalyticsConsent() {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.__denotenmanGoogleAnalyticsReady = false;
}

export function sendGoogleAnalyticsEvent(
  eventName: string,
  parameters: Record<string, unknown>
): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !hasCurrentAnalyticsConsent()
  ) {
    return false;
  }

  const eventParameters = isMollieReferrer(document.referrer)
    ? { ...parameters, ignore_referrer: true }
    : parameters;

  window.gtag("event", eventName, eventParameters);
  return true;
}

export function sendGoogleAnalyticsEventBeforeNavigation(
  eventName: string,
  parameters: Record<string, unknown>,
  navigate: () => void,
  timeoutMs = 500
) {
  let navigated = false;
  const continueNavigation = () => {
    if (navigated) return;
    navigated = true;
    navigate();
  };

  const sent = sendGoogleAnalyticsEvent(eventName, {
    ...parameters,
    event_callback: continueNavigation,
    event_timeout: timeoutMs,
  });

  if (!sent) {
    continueNavigation();
    return;
  }

  window.setTimeout(continueNavigation, timeoutMs + 50);
}
