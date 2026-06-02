import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Stripe } from "stripe/cjs/stripe.core";
import { StripeEventRepository } from "../repositories/stripe-event.repository";
import type { PrismaService } from "../../prisma/prisma.service";

function makeStripeEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
  return {
    id: "evt_test_abc123",
    type: "checkout.session.completed",
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object: {} as Stripe.Checkout.Session },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    ...overrides,
  } as Stripe.Event;
}

function makeStoredRow() {
  return {
    id: "evt_test_abc123",
    type: "checkout.session.completed",
    payload: {} as Record<string, unknown>,
    processedAt: new Date(),
  };
}

type StoredRow = ReturnType<typeof makeStoredRow>;

function makePrismaMock(createImpl: () => Promise<StoredRow>) {
  const create = vi.fn().mockImplementation(createImpl);
  const prisma = {
    stripeEvent: { create },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
  return { prisma, create };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StripeEventRepository.recordEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path — inserts row and returns { duplicate: false, event }", async () => {
    const row = makeStoredRow();
    const { prisma, create } = makePrismaMock(() => Promise.resolve(row));
    const repo = new StripeEventRepository(prisma);

    const event = makeStripeEvent();
    const result = await repo.recordEvent(event);

    expect(result.duplicate).toBe(false);
    expect(result.event).toEqual(row);
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: {
        id: event.id,
        type: event.type,
        payload: event,
      },
    });
  });

  it("P2002 unique violation — returns { duplicate: true } without re-throwing", async () => {
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    const { prisma } = makePrismaMock(() => Promise.reject(p2002));
    const repo = new StripeEventRepository(prisma);

    const event = makeStripeEvent();
    const result = await repo.recordEvent(event);

    expect(result.duplicate).toBe(true);
    expect(result.event).toBeUndefined();
  });

  it("non-P2002 error — propagates the error", async () => {
    const dbError = Object.assign(new Error("Connection refused"), { code: "P1001" });
    const { prisma } = makePrismaMock(() => Promise.reject(dbError));
    const repo = new StripeEventRepository(prisma);

    const event = makeStripeEvent();
    await expect(repo.recordEvent(event)).rejects.toThrow("Connection refused");
  });

  it("uses supplied tx instead of prisma client when provided", async () => {
    const row = makeStoredRow();
    const txCreate = vi.fn().mockResolvedValue(row);
    const tx = { stripeEvent: { create: txCreate } } as unknown as Parameters<
      Parameters<PrismaService["$transaction"]>[0]
    >[0];

    const { prisma, create: prismaCreate } = makePrismaMock(() => Promise.resolve(row));
    const repo = new StripeEventRepository(prisma);

    const event = makeStripeEvent();
    const result = await repo.recordEvent(event, tx);

    expect(result.duplicate).toBe(false);
    expect(txCreate).toHaveBeenCalledOnce();
    expect(prismaCreate).not.toHaveBeenCalled();
  });
});
