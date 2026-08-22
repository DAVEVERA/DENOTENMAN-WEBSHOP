"use client";

import { useEffect } from "react";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  parseCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";
import { PRODUCT_VIEW_SESSION_KEY_PREFIX } from "@/lib/product-view-consent";

export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    const sessionKey = `${PRODUCT_VIEW_SESSION_KEY_PREFIX}${productId}`;
    let disposed = false;
    let inFlight = false;

    async function recordWhenAllowed(consent: CookieConsent | null) {
      if (!consent?.analytics || inFlight || window.sessionStorage.getItem(sessionKey)) return;
      inFlight = true;

      try {
        const response = await fetch(
          `/api/storefront/products/${encodeURIComponent(productId)}/view`,
          { method: "POST", headers: { Accept: "application/json" }, keepalive: true }
        );
        if (!disposed && response.ok) window.sessionStorage.setItem(sessionKey, "1");
      } catch {
        // A metric must never interrupt product browsing. A later mount can retry.
      } finally {
        inFlight = false;
      }
    }

    function handleConsent(event: Event) {
      const detail = (event as CustomEvent<CookieConsent>).detail;
      void recordWhenAllowed(detail);
    }

    void recordWhenAllowed(
      parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
    );
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => {
      disposed = true;
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    };
  }, [productId]);

  return null;
}
