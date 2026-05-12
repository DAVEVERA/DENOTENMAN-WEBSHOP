import type { Stripe } from "stripe/cjs/stripe.core";
import type { PrismaTransaction } from "../repositories/stripe-event.repository";

/**
 * Handles `payment_intent.payment_failed`.
 *
 * Marks the order `cancelled`. The order stays in the DB so the customer can
 * retry via a new checkout session.
 *
 * TODO(worker): enqueue payment-failed email in sprint 3.
 */
export async function handlePaymentIntentPaymentFailed(
  event: Stripe.Event,
  tx: PrismaTransaction,
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await tx.order.updateMany({
    where: {
      stripePaymentIntent: paymentIntent.id,
      status: { in: ["pending", "paid"] },
    },
    data: { status: "cancelled" },
  });
}
