import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Stripe } from "stripe/cjs/stripe.core";
import { handleCheckoutSessionCompleted } from "../handlers/checkout-session-completed.handler";
import { handlePaymentIntentPaymentFailed } from "../handlers/payment-intent-payment-failed.handler";
import { handleChargeRefunded } from "../handlers/charge-refunded.handler";
import type { PrismaTransaction } from "../repositories/stripe-event.repository";
import type { OrderStateService } from "../../orders/order-state.service";

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

function makeOrderStateService() {
  const markAsPaid = vi.fn().mockResolvedValue(undefined);
  const markAsFailed = vi.fn().mockResolvedValue(undefined);
  const markAsRefunded = vi.fn().mockResolvedValue(undefined);
  const svc = { markAsPaid, markAsFailed, markAsRefunded } as unknown as OrderStateService;
  return { svc, markAsPaid, markAsFailed, markAsRefunded };
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

function makePaymentFailedEvent(paymentIntentId = "pi_test", sessionId?: string): Stripe.Event {
  return {
    id: "evt_2",
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: paymentIntentId,
        metadata: sessionId ? { stripeSessionId: sessionId } : {},
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

  it("happy path — calls markAsPaid with session and payment intent", async () => {
    const { tx } = makeTx();
    const { svc, markAsPaid } = makeOrderStateService();
    await handleCheckoutSessionCompleted(makeCheckoutCompletedEvent("cs_1", "pi_1"), tx, svc);

    expect(markAsPaid).toHaveBeenCalledOnce();
    expect(markAsPaid).toHaveBeenCalledWith("cs_1", "pi_1", tx);
  });

  it("handles payment_intent as object with .id property", async () => {
    const { tx } = makeTx();
    const { svc, markAsPaid } = makeOrderStateService();
    await handleCheckoutSessionCompleted(
      makeCheckoutCompletedEvent("cs_obj", { id: "pi_obj_1" }),
      tx,
      svc,
    );

    expect(markAsPaid).toHaveBeenCalledWith("cs_obj", "pi_obj_1", tx);
  });

  it("skips when paymentIntentId is null", async () => {
    const { tx } = makeTx();
    const { svc, markAsPaid } = makeOrderStateService();
    await handleCheckoutSessionCompleted(
      makeCheckoutCompletedEvent("cs_null", null as unknown as string),
      tx,
      svc,
    );

    expect(markAsPaid).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// payment-intent-payment-failed handler
// ---------------------------------------------------------------------------

describe("handlePaymentIntentPaymentFailed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses markAsFailed when sessionId is in metadata", async () => {
    const { tx } = makeTx();
    const { svc, markAsFailed } = makeOrderStateService();
    await handlePaymentIntentPaymentFailed(
      makePaymentFailedEvent("pi_failed", "cs_failed"),
      tx,
      svc,
    );

    expect(markAsFailed).toHaveBeenCalledOnce();
    expect(markAsFailed).toHaveBeenCalledWith("cs_failed", tx);
  });

  it("falls back to tx.order.updateMany when sessionId is missing", async () => {
    const { tx, updateMany } = makeTx();
    const { svc, markAsFailed } = makeOrderStateService();
    await handlePaymentIntentPaymentFailed(makePaymentFailedEvent("pi_failed"), tx, svc);

    expect(markAsFailed).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        stripePaymentIntent: "pi_failed",
        status: { in: ["pending", "paid"] },
      },
      data: { status: "cancelled", cancelledAt: expect.any(Date) as Date },
    });
  });
});

// ---------------------------------------------------------------------------
// charge-refunded handler
// ---------------------------------------------------------------------------

describe("handleChargeRefunded", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — calls markAsRefunded", async () => {
    const { tx } = makeTx();
    const { svc, markAsRefunded } = makeOrderStateService();
    await handleChargeRefunded(makeChargeRefundedEvent("pi_refund"), tx, svc);

    expect(markAsRefunded).toHaveBeenCalledOnce();
    expect(markAsRefunded).toHaveBeenCalledWith("pi_refund", tx);
  });

  it("charge without payment_intent — skips gracefully", async () => {
    const { tx } = makeTx();
    const { svc, markAsRefunded } = makeOrderStateService();
    await handleChargeRefunded(makeChargeRefundedEvent(null), tx, svc);

    expect(markAsRefunded).not.toHaveBeenCalled();
  });
});
