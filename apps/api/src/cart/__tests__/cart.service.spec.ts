import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { CartService } from "../cart.service";
import type { CartRepository, CartWithLines } from "../repositories/cart.repository";
import type { OrderRepository } from "../../orders/repositories/order.repository";
import type { StripeService } from "../../stripe/stripe.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { PinoLogger } from "nestjs-pino";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-12T10:00:00Z");

function makeVariant(
  overrides: Partial<{
    id: string;
    productId: string;
    name: string;
    priceCents: number;
    stockQuantity: number;
    currency: string;
    deletedAt: Date | null;
    product: { id: string; name: string; status: string };
  }> = {},
) {
  return {
    id: "var-uuid-1",
    productId: "prod-uuid-1",
    sku: "SKU-001",
    name: "250g",
    weightGrams: 250,
    priceCents: 1200,
    currency: "EUR",
    stockQuantity: 10,
    lowStockAt: 2,
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    product: { id: "prod-uuid-1", name: "Cashew Naturel", status: "active" },
    ...overrides,
  };
}

function makeCartLine(
  overrides: Partial<{
    id: string;
    cartId: string;
    productId: string;
    variantId: string;
    quantity: number;
  }> = {},
) {
  return {
    id: "line-uuid-1",
    cartId: "cart-uuid-1",
    productId: "prod-uuid-1",
    variantId: "var-uuid-1",
    quantity: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCart(overrides: Partial<CartWithLines> = {}): CartWithLines {
  return {
    id: "cart-uuid-1",
    customerId: null,
    token: "tok-abc",
    currency: "EUR",
    expiresAt: new Date(Date.now() + 86400_000),
    createdAt: NOW,
    updatedAt: NOW,
    lines: [],
    ...overrides,
  };
}

interface CartRepoMocks {
  repo: CartRepository;
  findById: ReturnType<typeof vi.fn>;
  findByToken: ReturnType<typeof vi.fn>;
  findByCustomerId: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  upsertLine: ReturnType<typeof vi.fn>;
  updateLine: ReturnType<typeof vi.fn>;
  removeLine: ReturnType<typeof vi.fn>;
  clearLines: ReturnType<typeof vi.fn>;
  lockCartLinesForUpdate: ReturnType<typeof vi.fn>;
  linkCustomer: ReturnType<typeof vi.fn>;
  mergeGuestCart: ReturnType<typeof vi.fn>;
}

function makeCartRepo(defaultCart: CartWithLines = makeCart()): CartRepoMocks {
  const findById = vi.fn().mockResolvedValue(defaultCart);
  const findByToken = vi.fn().mockResolvedValue(null);
  const findByCustomerId = vi.fn().mockResolvedValue(null);
  const create = vi.fn().mockImplementation((data: Partial<CartWithLines>) =>
    Promise.resolve({
      ...defaultCart,
      ...data,
      lines: [],
    }),
  );
  const upsertLine = vi.fn().mockResolvedValue({ ...defaultCart, lines: [makeCartLine()] });
  const updateLine = vi.fn().mockResolvedValue({ ...defaultCart, lines: [makeCartLine()] });
  const removeLine = vi.fn().mockResolvedValue({ ...defaultCart, lines: [] });
  const clearLines = vi.fn().mockResolvedValue({ ...defaultCart, lines: [] });
  const lockCartLinesForUpdate = vi.fn().mockResolvedValue(undefined);
  const linkCustomer = vi.fn().mockResolvedValue(defaultCart);
  const mergeGuestCart = vi.fn().mockResolvedValue(undefined);

  const repo = {
    findById,
    findByToken,
    findByCustomerId,
    create,
    upsertLine,
    updateLine,
    removeLine,
    clearLines,
    lockCartLinesForUpdate,
    linkCustomer,
    mergeGuestCart,
  } as unknown as CartRepository;

  return {
    repo,
    findById,
    findByToken,
    findByCustomerId,
    create,
    upsertLine,
    updateLine,
    removeLine,
    clearLines,
    lockCartLinesForUpdate,
    linkCustomer,
    mergeGuestCart,
  };
}

function makeOrderRepo() {
  const create = vi.fn().mockResolvedValue({
    id: "order-uuid-1",
    orderNumber: "ORD-TEST",
    customerId: null,
    status: "pending",
    lines: [],
    currency: "EUR",
    subtotalCents: 2400,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 2400,
    stripeSessionId: null,
    stripePaymentIntent: null,
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    notes: null,
    guestEmail: null,
    shippingAddressId: null,
    billingAddressId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const updateStripeSession = vi.fn().mockResolvedValue(undefined);
  const repo = { create, updateStripeSession } as unknown as OrderRepository;
  return { repo, create, updateStripeSession };
}

function makeStripeService() {
  const createCheckoutSession = vi.fn().mockResolvedValue({
    sessionId: "cs_test_abc",
    url: "https://checkout.stripe.com/pay/cs_test_abc",
  });
  const svc = { createCheckoutSession } as unknown as StripeService;
  return { svc, createCheckoutSession };
}

function makePrisma(variant = makeVariant()) {
  const $transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const fakeTx = {
      order: {
        create: vi.fn().mockResolvedValue({
          id: "order-uuid-1",
          orderNumber: "ORD-TX",
          customerId: null,
          status: "pending",
          lines: [],
          currency: "EUR",
          subtotalCents: 2400,
          shippingCents: 0,
          taxCents: 0,
          totalCents: 2400,
          stripeSessionId: null,
          stripePaymentIntent: null,
          paidAt: null,
          fulfilledAt: null,
          cancelledAt: null,
          notes: null,
          guestEmail: null,
          shippingAddressId: null,
          billingAddressId: null,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    return cb(fakeTx);
  });

  const productVariant = {
    findUnique: vi.fn().mockResolvedValue(variant),
    findMany: vi.fn().mockResolvedValue([variant]),
  };

  const prisma = { $transaction, productVariant } as unknown as PrismaService;
  return { prisma, $transaction, productVariant };
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

function makeService(
  overrides: {
    cart?: CartWithLines;
    variant?: ReturnType<typeof makeVariant>;
  } = {},
) {
  const cart = overrides.cart ?? makeCart();
  const variant = overrides.variant ?? makeVariant();
  const { repo: cartRepo, ...cartMocks } = makeCartRepo(cart);
  const { repo: orderRepo, ...orderMocks } = makeOrderRepo();
  const { svc: stripeService, ...stripeMocks } = makeStripeService();
  const { prisma, ...prismaMocks } = makePrisma(variant);
  const logger = makeLogger();

  const service = new CartService(cartRepo, orderRepo, stripeService, prisma, logger);

  return {
    service,
    cartMocks,
    orderMocks,
    stripeMocks,
    prismaMocks,
    cartRepo,
    orderRepo,
    stripeService,
    prisma,
  };
}

// ---------------------------------------------------------------------------
// addLine
// ---------------------------------------------------------------------------

describe("CartService.addLine — server-side pricing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — uses DB price, not client-supplied price", async () => {
    const cart = makeCart({ id: "cart-uuid-1", customerId: null });
    const { service, prismaMocks, cartMocks } = makeService({ cart });

    const result = await service.addLine("cart-uuid-1", null, null, "var-uuid-1", 2);

    // Variant looked up from DB
    expect(prismaMocks.productVariant.findUnique).toHaveBeenCalledOnce();
    // upsertLine called with DB-validated data
    expect(cartMocks.upsertLine).toHaveBeenCalledOnce();
    expect(result.lines).toHaveLength(1);
  });

  it("client-supplied price is never accepted — only variantId + quantity are used", async () => {
    const cart = makeCart({ id: "cart-uuid-1", customerId: null });
    const { service, prismaMocks } = makeService({ cart });

    // Regardless of what a client might try to inject, addLine only takes variantId + quantity.
    await service.addLine("cart-uuid-1", null, null, "var-uuid-1", 1);

    // The variant price comes from the DB findUnique — no client value can override it.
    const call = prismaMocks.productVariant.findUnique.mock.calls[0] as [{ where: { id: string } }];
    expect(call[0].where.id).toBe("var-uuid-1");
  });

  it("quantity exceeds stock → 422 INSUFFICIENT_STOCK", async () => {
    const variant = makeVariant({ stockQuantity: 3 });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null });
    const { service } = makeService({ cart, variant });

    await expect(service.addLine("cart-uuid-1", null, null, "var-uuid-1", 5)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("inactive product → 422 PRODUCT_NOT_ACTIVE", async () => {
    const variant = makeVariant({ product: { id: "p1", name: "Test", status: "archived" } });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null });
    const { service } = makeService({ cart, variant });

    await expect(service.addLine("cart-uuid-1", null, null, "var-uuid-1", 1)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("variant not found → 404", async () => {
    const cart = makeCart({ id: "cart-uuid-1", customerId: null });
    const { service, prismaMocks } = makeService({ cart });
    prismaMocks.productVariant.findUnique.mockResolvedValue(null);

    await expect(service.addLine("cart-uuid-1", null, null, "var-uuid-missing", 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ---------------------------------------------------------------------------
// updateLine
// ---------------------------------------------------------------------------

describe("CartService.updateLine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("quantity above stock → 422", async () => {
    const line = makeCartLine({ id: "line-uuid-1", variantId: "var-uuid-1" });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [line] });
    const variant = makeVariant({ stockQuantity: 2 });
    const { service } = makeService({ cart, variant });

    await expect(service.updateLine("cart-uuid-1", "line-uuid-1", null, null, 5)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("line not in cart → 404", async () => {
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [] });
    const { service } = makeService({ cart });

    await expect(
      service.updateLine("cart-uuid-1", "line-uuid-missing", null, null, 1),
    ).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// removeLine
// ---------------------------------------------------------------------------

describe("CartService.removeLine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — returns cart without the removed line", async () => {
    const line = makeCartLine({ id: "line-uuid-1" });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [line] });
    const { service, cartMocks } = makeService({ cart });

    const result = await service.removeLine("cart-uuid-1", "line-uuid-1", null, null);

    expect(cartMocks.removeLine).toHaveBeenCalledOnce();
    expect(result.lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkout
// ---------------------------------------------------------------------------

describe("CartService.checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path — creates pending Order, calls Stripe, saves sessionId", async () => {
    const line = makeCartLine({ id: "line-uuid-1", variantId: "var-uuid-1", quantity: 2 });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [line] });
    const { service, orderMocks, stripeMocks } = makeService({ cart });

    const result = await service.checkout(
      "cart-uuid-1",
      null,
      "user-uuid-1",
      null,
      "https://example.com/success",
      "https://example.com/cancel",
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledOnce();
    expect(orderMocks.updateStripeSession).toHaveBeenCalledWith("order-uuid-1", "cs_test_abc");
    expect(result).toEqual({
      sessionId: "cs_test_abc",
      url: "https://checkout.stripe.com/pay/cs_test_abc",
      orderId: "order-uuid-1",
    });
  });

  it("empty cart → 422 CART_EMPTY", async () => {
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [] });
    const { service } = makeService({ cart });

    await expect(
      service.checkout("cart-uuid-1", null, "user-1", null, "https://ok.com", "https://cancel.com"),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("cart belonging to another user → 403", async () => {
    // Cart is owned by "customer-abc". The requesting user passes "customer-intruder"
    // as their own customerId. assertCartAccess compares cart.customerId against
    // cartOwnerId (the caller's customerId) and throws 403 on mismatch.
    const cartWithLines = makeCart({
      id: "cart-uuid-2",
      customerId: "customer-abc",
      lines: [makeCartLine()],
    });
    const { service: svc2, cartMocks: cm2 } = makeService({ cart: cartWithLines });
    cm2.findById.mockResolvedValue(cartWithLines);

    await expect(
      svc2.checkout(
        "cart-uuid-2",
        "customer-intruder", // caller's customerId — does not match cart.customerId
        "user-intruder",
        "customer-intruder",
        "https://ok.com",
        "https://cancel.com",
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("insufficient stock on checkout → 422", async () => {
    const line = makeCartLine({ id: "line-uuid-1", variantId: "var-uuid-1", quantity: 20 });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [line] });
    const variant = makeVariant({ stockQuantity: 5 });
    const { service } = makeService({ cart, variant });

    await expect(
      service.checkout("cart-uuid-1", null, "user-1", null, "https://ok.com", "https://cancel.com"),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("concurrent checkout — row lock acquired before order creation", async () => {
    const line = makeCartLine({ id: "line-uuid-1", variantId: "var-uuid-1", quantity: 2 });
    const cart = makeCart({ id: "cart-uuid-1", customerId: null, lines: [line] });
    const { service, cartMocks } = makeService({ cart });

    await service.checkout(
      "cart-uuid-1",
      null,
      "user-1",
      null,
      "https://ok.com",
      "https://cancel.com",
    );

    // lockCartLinesForUpdate must have been called inside the transaction
    expect(cartMocks.lockCartLinesForUpdate).toHaveBeenCalledOnce();
  });
});
