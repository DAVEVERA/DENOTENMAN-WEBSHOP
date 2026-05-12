import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Stripe } from "stripe/cjs/stripe.core";
import { handleCheckoutSessionCompleted } from "../handlers/checkout-session-completed.handler";
import { handlePaymentIntentPaymentFailed } from "../handlers/payment-intent-payment-failed.handler";
import { handleChargeRefunded } from "../handlers/charge-refunded.handler";
import type { PrismaTransaction } from "../repositories/stripe-event.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx() {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    order: { updateMany },
  } as unknown as PrismaTransaction;
  return { tx, updateMany };
}

function makeCheckoutCompletedEvent(
  sessionId = "cs_test",
  paymentIntent: string | { id: string } = "pi_test",
): Stripe.Event {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_intent: paymentIntent,
      } as Stripe.Checkout.Session,
    },
  } as unknown as Stripe.Event;
}

function makePaymentFailedEvent(paymentIntentId = "pi_test"): Stripe.Event {
  return {
    id: "evt_2",
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: paymentIntentId,
      } as Stripe.PaymentIntent,
    },
  } as unknown as Stripe.Event;
}

function makeChargeRefundedEvent(paymentIntentId: string | null = "pi_test"): Stripe.Event {
  return {
    id: "evt_3",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_test",
        payment_intent: paymentIntentId,
      } as Stripe.Charge,
    },
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// checkout-session-completed handler
// ---------------------------------------------------------------------------

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — updates order to paid with session and payment intent", async () => {
    const { tx, updateMany } = makeTx();
    await handleCheckoutSessionCompleted(makeCheckoutCompletedEvent("cs_1", "pi_1"), tx);

    expect(updateMany).toHaveBeenCalledOnce();
    const [callArgs] = updateMany.mock.calls as [
      [
        {
          where: { stripeSessionId: string; status: string };
          data: { status: string; stripePaymentIntent: string; paidAt: Date };
        },
      ],
    ];
    expect(callArgs[0].where).toEqual({ stripeSessionId: "cs_1", status: "pending" });
    expect(callArgs[0].data.status).toBe("paid");
    expect(callArgs[0].data.stripePaymentIntent).toBe("pi_1");
    expect(callArgs[0].data.paidAt).toBeInstanceOf(Date);
  });

  it("handles payment_intent as object with .id property", async () => {
    const { tx, updateMany } = makeTx();
    await handleCheckoutSessionCompleted(
      makeCheckoutCompletedEvent("cs_obj", { id: "pi_obj_1" }),
      tx,
    );

    const [callArgs] = updateMany.mock.calls as [[{ data: { stripePaymentIntent: string } }]];
    expect(callArgs[0].data.stripePaymentIntent).toBe("pi_obj_1");
  });
});

// ---------------------------------------------------------------------------
// payment-intent-payment-failed handler
// ---------------------------------------------------------------------------

describe("handlePaymentIntentPaymentFailed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — updates order to cancelled", async () => {
    const { tx, updateMany } = makeTx();
    await handlePaymentIntentPaymentFailed(makePaymentFailedEvent("pi_failed"), tx);

    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        stripePaymentIntent: "pi_failed",
        status: { in: ["pending", "paid"] },
      },
      data: { status: "cancelled" },
    });
  });
});

// ---------------------------------------------------------------------------
// charge-refunded handler
// ---------------------------------------------------------------------------

describe("handleChargeRefunded", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — updates order to refunded", async () => {
    const { tx, updateMany } = makeTx();
    await handleChargeRefunded(makeChargeRefundedEvent("pi_refund"), tx);

    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        stripePaymentIntent: "pi_refund",
        status: { in: ["paid", "fulfilled"] },
      },
      data: { status: "refunded" },
    });
  });

  it("charge without payment_intent — skips updateMany gracefully", async () => {
    const { tx, updateMany } = makeTx();
    await handleChargeRefunded(makeChargeRefundedEvent(null), tx);

    expect(updateMany).not.toHaveBeenCalled();
  });
});
