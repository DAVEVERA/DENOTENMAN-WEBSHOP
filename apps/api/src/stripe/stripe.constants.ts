import type { Stripe } from "stripe/cjs/stripe.core";

/**
 * Stripe event types this handler processes.
 * Unlisted types are logged and skipped with a 200 response.
 */
export const SUPPORTED_EVENT_TYPES: readonly Stripe.Event.Type[] = [
  "checkout.session.completed",
  "payment_intent.payment_failed",
  "charge.refunded",
] as const;

/**
 * Throttler configuration per route group (rpm = requests per minute).
 */
export const STRIPE_THROTTLE = {
  /** Authenticated checkout session creation. */
  checkout: { name: "auth", ttl: 60_000, limit: 30 },
} as const;

/** Injection token for the Stripe SDK singleton. */
export const STRIPE_CLIENT = Symbol("STRIPE_CLIENT");
