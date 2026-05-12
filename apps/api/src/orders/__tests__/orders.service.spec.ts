import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { OrdersService } from "../orders.service";
import type { OrderRepository, OrderWithLines } from "../repositories/order.repository";
import type { PinoLogger } from "nestjs-pino";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-12T10:00:00Z");

function makeOrder(overrides: Partial<OrderWithLines> = {}): OrderWithLines {
  return {
    id: "order-uuid-1",
    orderNumber: "ORD-TEST-001",
    customerId: "customer-uuid-1",
    guestEmail: null,
    status: "pending",
    currency: "EUR",
    subtotalCents: 2400,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 2400,
    shippingAddressId: null,
    billingAddressId: null,
    stripeSessionId: "cs_test_abc",
    stripePaymentIntent: null,
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    lines: [],
    ...overrides,
  };
}

interface RepoMocks {
  repo: OrderRepository;
  findById: ReturnType<typeof vi.fn>;
  findByStripeSessionId: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  markAsPaid: ReturnType<typeof vi.fn>;
  markAsFailed: ReturnType<typeof vi.fn>;
  markAsRefunded: ReturnType<typeof vi.fn>;
  updateStripeSession: ReturnType<typeof vi.fn>;
}

function makeRepo(defaultOrder: OrderWithLines | null = makeOrder()): RepoMocks {
  const findById = vi.fn().mockResolvedValue(defaultOrder);
  const findByStripeSessionId = vi.fn().mockResolvedValue(defaultOrder);
  const list = vi.fn().mockResolvedValue({ items: [defaultOrder ?? makeOrder()], total: 1 });
  const markAsPaid = vi.fn().mockResolvedValue(undefined);
  const markAsFailed = vi.fn().mockResolvedValue(undefined);
  const markAsRefunded = vi.fn().mockResolvedValue(undefined);
  const updateStripeSession = vi.fn().mockResolvedValue(undefined);

  const repo = {
    findById,
    findByStripeSessionId,
    list,
    markAsPaid,
    markAsFailed,
    markAsRefunded,
    updateStripeSession,
  } as unknown as OrderRepository;

  return {
    repo,
    findById,
    findByStripeSessionId,
    list,
    markAsPaid,
    markAsFailed,
    markAsRefunded,
    updateStripeSession,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

// ---------------------------------------------------------------------------
// markAsPaid
// ---------------------------------------------------------------------------

describe("OrdersService.markAsPaid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to repo.markAsPaid with tx", async () => {
    const { repo, markAsPaid } = makeRepo();
    const svc = new OrdersService(repo, makeLogger());
    const fakeTx = {} as never;

    await svc.markAsPaid("cs_test", "pi_test", fakeTx);

    expect(markAsPaid).toHaveBeenCalledOnce();
    expect(markAsPaid).toHaveBeenCalledWith("cs_test", "pi_test", fakeTx);
  });

  it("works without tx (undefined)", async () => {
    const { repo, markAsPaid } = makeRepo();
    const svc = new OrdersService(repo, makeLogger());

    await svc.markAsPaid("cs_test", "pi_test");

    expect(markAsPaid).toHaveBeenCalledWith("cs_test", "pi_test", undefined);
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe("OrdersService.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner can retrieve their own order → 200", async () => {
    const order = makeOrder({ customerId: "customer-uuid-1" });
    const { repo } = makeRepo(order);
    const svc = new OrdersService(repo, makeLogger());

    const result = await svc.findById("order-uuid-1", "customer-uuid-1", false);

    expect(result.id).toBe("order-uuid-1");
  });

  it("different user → 404 (existence not leaked)", async () => {
    const order = makeOrder({ customerId: "customer-uuid-1" });
    const { repo } = makeRepo(order);
    const svc = new OrdersService(repo, makeLogger());

    await expect(svc.findById("order-uuid-1", "different-user", false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("admin can retrieve any order", async () => {
    const order = makeOrder({ customerId: "customer-uuid-1" });
    const { repo } = makeRepo(order);
    const svc = new OrdersService(repo, makeLogger());

    const result = await svc.findById("order-uuid-1", "admin-user", true);

    expect(result.id).toBe("order-uuid-1");
  });

  it("order not found → 404", async () => {
    const { repo } = makeRepo(null);
    const svc = new OrdersService(repo, makeLogger());

    await expect(svc.findById("missing-id", "any-user", false)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// findByUser
// ---------------------------------------------------------------------------

describe("OrdersService.findByUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the requesting user's orders", async () => {
    const order = makeOrder({ customerId: "customer-uuid-1" });
    const { repo, list } = makeRepo(order);
    const svc = new OrdersService(repo, makeLogger());

    const result = await svc.findByUser("customer-uuid-1", { page: 1, pageSize: 20 });

    expect(list).toHaveBeenCalledOnce();
    const callArgs = list.mock.calls[0] as [{ customerId: string }];
    expect(callArgs[0].customerId).toBe("customer-uuid-1");
    expect(result.items).toHaveLength(1);
  });
});
