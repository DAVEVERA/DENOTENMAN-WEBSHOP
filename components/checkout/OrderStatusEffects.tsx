"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GOOGLE_ANALYTICS_READY_EVENT,
  sendGoogleAnalyticsEvent,
  type GoogleAnalyticsPurchase,
} from "@/lib/analytics";
import { COOKIE_CONSENT_EVENT } from "@/lib/cookie-consent";
import { clearCart } from "@/lib/storefront-state";

export type OrderAnalyticsMeasurement = {
  transactionId: string;
  paymentStatus: string;
  paymentMethod: string;
  purchase?: GoogleAnalyticsPurchase;
};

function wasSent(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) === "sent";
  } catch {
    return false;
  }
}

function markSent(storage: Storage, key: string) {
  try {
    storage.setItem(key, "sent");
  } catch {
    // Analytics must never interfere with order confirmation or cart state.
  }
}

export function OrderStatusEffects({
  status,
  measurement,
}: {
  status: "PAID" | "PENDING" | "CANCELLED";
  measurement?: OrderAnalyticsMeasurement;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status === "PAID") {
      clearCart();
    }
  }, [status]);

  useEffect(() => {
    if (status !== "PENDING") return;
    const timeout = setTimeout(() => router.refresh(), 4000);
    return () => clearTimeout(timeout);
  }, [status, router]);

  useEffect(() => {
    if (!measurement) return;
    const analytics: OrderAnalyticsMeasurement = measurement;

    function trackConfirmedState() {
      if (!window.__denotenmanGoogleAnalyticsReady) return;

      const statusKey = `denotenman-ga4-payment-status:${analytics.transactionId}:${analytics.paymentStatus}`;
      if (!wasSent(window.sessionStorage, statusKey)) {
        const statusSent = sendGoogleAnalyticsEvent("checkout_payment_status", {
          transaction_id: analytics.transactionId,
          payment_provider: "mollie",
          payment_method: analytics.paymentMethod,
          payment_status: analytics.paymentStatus,
        });
        if (statusSent) markSent(window.sessionStorage, statusKey);
      }

      if (!analytics.purchase) return;

      const purchaseKey = `denotenman-ga4-purchase:${analytics.purchase.transaction_id}`;
      if (wasSent(window.localStorage, purchaseKey)) return;

      if (sendGoogleAnalyticsEvent("purchase", analytics.purchase)) {
        markSent(window.localStorage, purchaseKey);
      }
    }

    trackConfirmedState();
    window.addEventListener(GOOGLE_ANALYTICS_READY_EVENT, trackConfirmedState);
    window.addEventListener(COOKIE_CONSENT_EVENT, trackConfirmedState);
    return () => {
      window.removeEventListener(GOOGLE_ANALYTICS_READY_EVENT, trackConfirmedState);
      window.removeEventListener(COOKIE_CONSENT_EVENT, trackConfirmedState);
    };
  }, [measurement]);

  return null;
}
