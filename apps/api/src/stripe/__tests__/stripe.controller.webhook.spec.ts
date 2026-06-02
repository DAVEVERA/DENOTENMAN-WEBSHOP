import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import StripeSDK from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core";
import { StripeController } from "../stripe.controller";
import type { StripeService } from "../stripe.service";
import type { PinoLogger } from "nestjs-pino";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_WEBHOOK_SECRET = "whsec_test_secret_32_bytes_xxxxx";

/** Builds a real Stripe event signature header using the SDK test helper. */
function buildSignature(payload: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  return StripeSDK.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: ts,
  });
}

function makeStripeEvent(type = "checkout.session.completed", id = "evt_test_1"): Stripe.Event {
  return {
    id,
    type,
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_test", payment_intent: "pi_test" } as Stripe.Checkout.Session },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

interface ServiceMockOptions {
  constructWebhookEvent?: (raw: Buffer, sig: string) => Stripe.Event;
  processWebhookEvent?: (event: Stripe.Event) => Promise<{ handled: boolean }>;
}

function makeServiceMock(options: ServiceMockOptions = {}) {
  const defaultConstruct = (raw: Buffer, sig: string): Stripe.Event => {
    return StripeSDK.webhooks.constructEvent(raw, sig, TEST_WEBHOOK_SECRET);
  };
  const defaultProcess = (_event: Stripe.Event): Promise<{ handled: boolean }> =>
    Promise.resolve({ handled: true });

  const constructWebhookEvent = vi.fn(options.constructWebhookEvent ?? defaultConstruct);
  const processWebhookEvent = vi.fn(options.processWebhookEvent ?? defaultProcess);
  const createCheckoutSession = vi.fn();

  const svc = {
    constructWebhookEvent,
    processWebhookEvent,
    createCheckoutSession,
  } as unknown as StripeService;

  return { svc, constructWebhookEvent, processWebhookEvent };
}

function makeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function makeController(svc: StripeService) {
  return new StripeController(svc, makeLogger());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StripeController.handleWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valid signature — 200 received:true, processWebhookEvent called once", async () => {
    const event = makeStripeEvent();
    const payload = JSON.stringify(event);
    const rawBody = Buffer.from(payload);
    const sig = buildSignature(payload, TEST_WEBHOOK_SECRET);

    const { svc, processWebhookEvent } = makeServiceMock({
      constructWebhookEvent: () => event,
    });
    const controller = makeController(svc);

    const result = await controller.handleWebhook(rawBody, sig);

    expect(result).toEqual({ received: true });
    expect(processWebhookEvent).toHaveBeenCalledOnce();
    expect(processWebhookEvent).toHaveBeenCalledWith(event);
  });

  it("tampered signature — throws BadRequestException 400, processWebhookEvent not called", async () => {
    const payload = JSON.stringify(makeStripeEvent());
    const rawBody = Buffer.from(payload);

    const { svc, processWebhookEvent } = makeServiceMock({
      constructWebhookEvent: () => {
        throw new BadRequestException({
          error: { code: "STRIPE_SIGNATURE_INVALID", message: "Ongeldige Stripe handtekening" },
        });
      },
    });
    const controller = makeController(svc);

    await expect(controller.handleWebhook(rawBody, "t=bad,v1=bad")).rejects.toThrow(
      BadRequestException,
    );
    expect(processWebhookEvent).not.toHaveBeenCalled();
  });

  it("replay (same event.id) — 200 received:true, processWebhookEvent returns handled:false", async () => {
    const event = makeStripeEvent("checkout.session.completed", "evt_duplicate");
    const payload = JSON.stringify(event);
    const rawBody = Buffer.from(payload);
    const sig = buildSignature(payload, TEST_WEBHOOK_SECRET);

    const { svc, processWebhookEvent } = makeServiceMock({
      constructWebhookEvent: () => event,
      processWebhookEvent: (_e: Stripe.Event) => Promise.resolve({ handled: false }),
    });
    const controller = makeController(svc);

    const result = await controller.handleWebhook(rawBody, sig);

    expect(result).toEqual({ received: true });
    expect(processWebhookEvent).toHaveBeenCalledOnce();
  });

  it("unknown event type — 200 received:true, processWebhookEvent returns handled:false", async () => {
    const event = makeStripeEvent("invoice.created", "evt_unknown");
    const payload = JSON.stringify(event);
    const rawBody = Buffer.from(payload);
    const sig = buildSignature(payload, TEST_WEBHOOK_SECRET);

    const { svc, processWebhookEvent } = makeServiceMock({
      constructWebhookEvent: () => event,
      processWebhookEvent: (_e: Stripe.Event) => Promise.resolve({ handled: false }),
    });
    const controller = makeController(svc);

    const result = await controller.handleWebhook(rawBody, sig);

    expect(result).toEqual({ received: true });
    expect(processWebhookEvent).toHaveBeenCalledWith(event);
  });

  it("missing stripe-signature header — throws BadRequestException 400", async () => {
    const { svc } = makeServiceMock();
    const controller = makeController(svc);

    await expect(controller.handleWebhook(Buffer.from("body"), "")).rejects.toThrow(
      BadRequestException,
    );
  });
});
