import type { Stripe } from "stripe/cjs/stripe.core";
import type { PrismaTransaction } from "../repositories/stripe-event.repository";

/**
 * Handles `checkout.session.completed`.
 *
 * Updates the matching Order to `paid` status and stores the Stripe session id
 * and payment intent id for reconciliation. All writes run inside the
 * transaction that also holds the StripeEvent insert — atomicity per ADR 0008.
 *
 * Lookup is by `stripeSessionId` which was written when the session was
 * created in StripeService.createCheckoutSession.
 *
 * TODO(worker): enqueue confirmation email after the worker is available in sprint 3.
 */
export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  tx: PrismaTransaction,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await tx.order.updateMany({
    where: { stripeSessionId: sessionId, status: "pending" },
    data: {
      status: "paid",
      stripePaymentIntent: paymentIntentId,
      paidAt: new Date(),
    },
  });
}
