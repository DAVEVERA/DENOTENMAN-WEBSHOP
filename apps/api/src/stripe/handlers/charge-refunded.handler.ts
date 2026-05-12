import type { Stripe } from "stripe/cjs/stripe.core";
import type { PrismaTransaction } from "../repositories/stripe-event.repository";

/**
 * Handles `charge.refunded`.
 *
 * Marks the order `refunded`. A charge carries `payment_intent` which lets us
 * locate the order.
 *
 * TODO(worker): enqueue refund-confirmation email in sprint 3.
 */
export async function handleChargeRefunded(
  event: Stripe.Event,
  tx: PrismaTransaction,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    return;
  }

  await tx.order.updateMany({
    where: {
      stripePaymentIntent: paymentIntentId,
      status: { in: ["paid", "fulfilled"] },
    },
    data: { status: "refunded" },
  });
}
