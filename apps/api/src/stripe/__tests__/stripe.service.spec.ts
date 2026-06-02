import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Stripe } from "stripe/cjs/stripe.core";
import type { Checkout } from "stripe/cjs/resources/Checkout/Sessions";
import { StripeService } from "../stripe.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { StripeEventRepository } from "../repositories/stripe-event.repository";
import type { PinoLogger } from "nestjs-pino";
import type StripeSDK from "stripe";
import type { OrderStateService } from "../../orders/order-state.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  weightGrams: number;
  priceCents: number;
  currency: string;
  stockQuantity: number;
  lowStockAt: number;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: null;
  product: { name: string; status: string };
}

function makeVariant(
  overrides: {
    id?: string;
    priceCents?: number;
    currency?: string;
    stockQuantity?: number;
    productStatus?: string;
    productName?: string;
    variantName?: string;
  } = {},
): MockVariant {
  return {
    id: overrides.id ?? "var-uuid-1",
    productId: "prod-uuid-1",
    sku: "NUT-001",
    name: overrides.variantName ?? "250g",
    weightGrams: 250,
    priceCents: overrides.priceCents ?? 1200,
    currency: overrides.currency ?? "EUR",
    stockQuantity: overrides.stockQuantity ?? 10,
    lowStockAt: 5,
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    product: {
      name: overrides.productName ?? "Cashews",
      status: overrides.productStatus ?? "active",
    },
  };
}

function makeStripeMock() {
  const create = vi.fn().mockResolvedValue({
    id: "cs_test_abc",
    url: "https://checkout.stripe.com/pay/cs_test_abc",
  });

  const constructEvent = vi.fn();

  const stripe = {
    checkout: { sessions: { create } },
    webhooks: { constructEvent },
  } as unknown as InstanceType<typeof StripeSDK>;

  return { stripe, create, constructEvent };
}

function makePrismaMock(variants: MockVariant[] = [makeVariant()]) {
  const findMany = vi.fn().mockResolvedValue(variants);
  const orderUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const transaction = vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      order: { updateMany: orderUpdateMany },
      stripeEvent: { create: vi.fn().mockResolvedValue({}) },
    });
  });
  const prisma = {
    productVariant: { findMany },
    order: { updateMany: orderUpdateMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  return { prisma, findMany, orderUpdateMany, transaction };
}

function makeRepoMock() {
  const recordEvent = vi.fn().mockResolvedValue({ duplicate: false });
  const repo = { recordEvent } as unknown as StripeEventRepository;
  return { repo, recordEvent };
}

function makeLogger(): PinoLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as PinoLogger;
}

function makeOrderStateSvcMock() {
  const markAsPaid = vi.fn().mockResolvedValue(undefined);
  const markAsFailed = vi.fn().mockResolvedValue(undefined);
  const markAsRefunded = vi.fn().mockResolvedValue(undefined);
  return { markAsPaid, markAsFailed, markAsRefunded } as unknown as OrderStateService;
}

function makeService(
  stripeMock: InstanceType<typeof StripeSDK>,
  prismaMock: PrismaService,
  repoMock: StripeEventRepository,
  logger?: PinoLogger,
  orderStateSvc?: OrderStateService,
): StripeService {
  return new StripeService(
    stripeMock,
    prismaMock,
    repoMock,
    orderStateSvc ?? makeOrderStateSvcMock(),
    logger ?? makeLogger(),
  );
}

// ---------------------------------------------------------------------------
// createCheckoutSession tests
// ---------------------------------------------------------------------------

describe("StripeService.createCheckoutSession — server-side pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses DB price (priceCents), not any client-supplied amount", async () => {
    const variant = makeVariant({ priceCents: 1500, currency: "EUR" });
    const { prisma } = makePrismaMock([variant]);
    const { stripe, create } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    await svc.createCheckoutSession(
      {
        cartId: "cart-uuid-1",
        lineItems: [{ variantId: variant.id, quantity: 2 }],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      },
      "user-uuid-1",
    );

    const callArgs = create.mock.calls[0] as [Checkout.SessionCreateParams];
    const params = callArgs[0];
    const lineItem = params.line_items?.[0];
    const priceData = lineItem?.price_data as { unit_amount: number; currency: string };
    expect(priceData.unit_amount).toBe(1500);
    expect(priceData.currency).toBe("eur");
  });

  it("quantity > stockQuantity → 422 INSUFFICIENT_STOCK", async () => {
    const variant = makeVariant({ stockQuantity: 3 });
    const { prisma } = makePrismaMock([variant]);
    const { stripe } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    await expect(
      svc.createCheckoutSession(
        {
          cartId: "cart-uuid-1",
          lineItems: [{ variantId: variant.id, quantity: 5 }],
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
        "user-1",
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("currency mismatch across variants → 422 CURRENCY_MISMATCH", async () => {
    const v1 = makeVariant({ id: "var-1", currency: "EUR" });
    const v2 = makeVariant({ id: "var-2", currency: "USD" });
    const { prisma } = makePrismaMock([v1, v2]);
    const { stripe } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    await expect(
      svc.createCheckoutSession(
        {
          cartId: "cart-uuid-1",
          lineItems: [
            { variantId: "var-1", quantity: 1 },
            { variantId: "var-2", quantity: 1 },
          ],
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
        "user-1",
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("variant not found → 404 VARIANT_NOT_FOUND", async () => {
    const { prisma } = makePrismaMock([]);
    const { stripe } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    await expect(
      svc.createCheckoutSession(
        {
          cartId: "cart-uuid-1",
          lineItems: [{ variantId: "550e8400-e29b-41d4-a716-446655440000", quantity: 1 }],
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
        "user-1",
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("inactive product → 422 PRODUCT_NOT_ACTIVE", async () => {
    const variant = makeVariant({ productStatus: "archived" });
    const { prisma } = makePrismaMock([variant]);
    const { stripe } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    await expect(
      svc.createCheckoutSession(
        {
          cartId: "cart-uuid-1",
          lineItems: [{ variantId: variant.id, quantity: 1 }],
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        },
        "user-1",
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("happy path — returns sessionId and url from Stripe", async () => {
    const variant = makeVariant();
    const { prisma } = makePrismaMock([variant]);
    const { stripe } = makeStripeMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    const result = await svc.createCheckoutSession(
      {
        cartId: "cart-uuid-1",
        lineItems: [{ variantId: variant.id, quantity: 1 }],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      },
      "user-1",
    );

    expect(result.sessionId).toBe("cs_test_abc");
    expect(result.url).toBe("https://checkout.stripe.com/pay/cs_test_abc");
  });
});

// ---------------------------------------------------------------------------
// constructWebhookEvent tests
// ---------------------------------------------------------------------------

describe("StripeService.constructWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valid signature — returns parsed event", () => {
    const fakeEvent = { id: "evt_1", type: "checkout.session.completed" } as Stripe.Event;
    const { stripe, constructEvent } = makeStripeMock();
    constructEvent.mockReturnValue(fakeEvent);
    const { prisma } = makePrismaMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    const result = svc.constructWebhookEvent(Buffer.from("raw"), "t=123,v1=abc");
    expect(result).toEqual(fakeEvent);
  });

  it("tampered signature — throws BadRequestException 400", () => {
    const { stripe, constructEvent } = makeStripeMock();
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const { prisma } = makePrismaMock();
    const { repo } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    expect(() => svc.constructWebhookEvent(Buffer.from("tampered"), "t=bad,v1=bad")).toThrow(
      BadRequestException,
    );
  });
});

// ---------------------------------------------------------------------------
// processWebhookEvent tests
// ---------------------------------------------------------------------------

describe("StripeService.processWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeEvent(type: string, id = "evt_test_1"): Stripe.Event {
    return {
      id,
      type,
      object: "event",
      api_version: "2026-04-22.dahlia",
      created: 0,
      data: { object: { id: "cs_test", payment_intent: "pi_test" } as Stripe.Checkout.Session },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as unknown as Stripe.Event;
  }

  it("unknown event type — returns { handled: false }, no side effect", async () => {
    const { stripe } = makeStripeMock();
    const { prisma } = makePrismaMock();
    const { repo, recordEvent } = makeRepoMock();
    const svc = makeService(stripe, prisma, repo);

    const result = await svc.processWebhookEvent(makeEvent("invoice.created"));
    expect(result.handled).toBe(false);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("duplicate event — returns { handled: false }, side-effect not called", async () => {
    const { stripe } = makeStripeMock();
    const { prisma, orderUpdateMany } = makePrismaMock();
    const { repo, recordEvent } = makeRepoMock();
    recordEvent.mockResolvedValue({ duplicate: true });

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          order: { updateMany: orderUpdateMany },
          stripeEvent: {
            create: vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" })),
          },
        });
      },
    );

    const svc = makeService(stripe, prisma, repo);
    const result = await svc.processWebhookEvent(makeEvent("checkout.session.completed"));

    expect(result.handled).toBe(false);
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("valid checkout.session.completed — returns { handled: true }, order state service called", async () => {
    const { stripe } = makeStripeMock();
    const { prisma } = makePrismaMock();
    const { repo } = makeRepoMock();
    const markAsPaid = vi.fn().mockResolvedValue(undefined);
    const orderStateSvc = {
      markAsPaid,
      markAsFailed: vi.fn().mockResolvedValue(undefined),
      markAsRefunded: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderStateService;

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          stripeEvent: { create: vi.fn().mockResolvedValue({}) },
        });
      },
    );

    const svc = makeService(stripe, prisma, repo, undefined, orderStateSvc);
    const result = await svc.processWebhookEvent(makeEvent("checkout.session.completed"));

    expect(result.handled).toBe(true);
    expect(markAsPaid).toHaveBeenCalledOnce();
  });
});
