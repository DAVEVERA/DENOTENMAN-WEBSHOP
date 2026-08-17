import "server-only";

import {
  OrderRefundStatus,
  Prisma,
  type AdminUser,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMollieClient } from "@/lib/mollie";
import { recordAudit } from "@/lib/admin-audit";
import {
  calculateOrderRefund,
  OrderRefundCalculationError,
  type RefundItemSelection,
} from "@/lib/order-refund-calculation";

export class OrderRefundError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = "OrderRefundError";
  }
}

type CreateOrderRefundInput = {
  orderId: string;
  requestId: string;
  selections: RefundItemSelection[];
  includeShipping: boolean;
  reason: string | null;
};

type ProviderRefund = {
  id: string;
  status: string;
  metadata: unknown;
};

export type OrderRefundProvider = {
  getPayment(paymentId: string): Promise<{
    status: string;
    amountRemaining?: { value: string };
  }>;
  listPaymentRefunds(paymentId: string): Promise<ProviderRefund[]>;
  createPaymentRefund(input: {
    paymentId: string;
    amountCents: number;
    description: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<ProviderRefund>;
};

function mollieRefundProvider(): OrderRefundProvider {
  const client = getMollieClient();
  return {
    getPayment: (paymentId) => client.payments.get(paymentId),
    listPaymentRefunds: async (paymentId) =>
      client.paymentRefunds.page({ paymentId, limit: 250 }),
    createPaymentRefund: ({
      paymentId,
      amountCents,
      description,
      metadata,
      idempotencyKey,
    }) =>
      client.paymentRefunds.create({
        paymentId,
        amount: { currency: "EUR", value: (amountCents / 100).toFixed(2) },
        description,
        metadata,
        idempotencyKey,
      }),
  };
}

const refundInclude = {
  items: true,
  order: true,
} satisfies Prisma.OrderRefundInclude;

type RefundWithContext = Prisma.OrderRefundGetPayload<{ include: typeof refundInclude }>;

function normalizeReason(reason: string | null): string | null {
  const trimmed = reason?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function centsFromMollieValue(value: string): number | null {
  if (!/^\d+(?:\.\d{2})$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function mapMollieRefundStatus(status: string): OrderRefundStatus {
  switch (status) {
    case "queued":
      return "QUEUED";
    case "pending":
      return "PENDING";
    case "processing":
      return "PROCESSING";
    case "refunded":
      return "REFUNDED";
    case "failed":
      return "FAILED";
    case "canceled":
      return "CANCELED";
    default:
      return "PENDING";
  }
}

function sameRequest(refund: RefundWithContext, input: CreateOrderRefundInput): boolean {
  if (
    refund.orderId !== input.orderId ||
    refund.includesShipping !== input.includeShipping ||
    refund.reason !== normalizeReason(input.reason) ||
    refund.items.length !== input.selections.length
  ) {
    return false;
  }

  const quantities = new Map(
    refund.items.map((item) => [item.orderItemId, item.quantity])
  );
  return input.selections.every(
    (selection) => quantities.get(selection.orderItemId) === selection.quantity
  );
}

function refundMetadataMatches(metadata: unknown, refundId: string): boolean {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      "orderRefundId" in metadata &&
      (metadata as { orderRefundId?: unknown }).orderRefundId === refundId
  );
}

async function findProviderRefund(
  refund: RefundWithContext,
  provider: OrderRefundProvider
) {
  if (!refund.order.molliePaymentId) return null;
  const page = await provider.listPaymentRefunds(refund.order.molliePaymentId);
  return (
    page.find((candidate) => candidate.id === refund.mollieRefundId) ??
    page.find((candidate) => refundMetadataMatches(candidate.metadata, refund.id)) ??
    null
  );
}

async function saveProviderRefund(
  refund: RefundWithContext,
  providerRefund: { id: string; status: string }
) {
  return prisma.orderRefund.update({
    where: { id: refund.id },
    data: {
      mollieRefundId: providerRefund.id,
      status: mapMollieRefundStatus(providerRefund.status),
    },
    include: refundInclude,
  });
}

async function executeProviderRefund(
  refund: RefundWithContext,
  provider: OrderRefundProvider
) {
  if (!refund.order.molliePaymentId) {
    throw new OrderRefundError("MOLLIE_PAYMENT_ID_MISSING", 409);
  }

  const reconciled = await findProviderRefund(refund, provider);
  if (reconciled) return saveProviderRefund(refund, reconciled);

  const payment = await provider.getPayment(refund.order.molliePaymentId);
  if (payment.status !== "paid") {
    await prisma.orderRefund.update({
      where: { id: refund.id },
      data: { status: "FAILED" },
    });
    throw new OrderRefundError("MOLLIE_PAYMENT_NOT_PAID", 409);
  }

  const remainingCents = payment.amountRemaining
    ? centsFromMollieValue(payment.amountRemaining.value)
    : null;
  if (remainingCents === null || refund.amountCents > remainingCents) {
    await prisma.orderRefund.update({
      where: { id: refund.id },
      data: { status: "FAILED" },
    });
    throw new OrderRefundError("MOLLIE_REFUND_AMOUNT_UNAVAILABLE", 409);
  }

  try {
    const providerRefund = await provider.createPaymentRefund({
      paymentId: refund.order.molliePaymentId,
      amountCents: refund.amountCents,
      description: `Deelannulering bestelling ${refund.orderId}`,
      metadata: {
        orderId: refund.orderId,
        orderRefundId: refund.id,
        requestId: refund.idempotencyKey,
      },
      idempotencyKey: refund.idempotencyKey,
    });
    return saveProviderRefund(refund, providerRefund);
  } catch (error) {
    console.error("Mollie partial refund creation is uncertain", {
      orderId: refund.orderId,
      orderRefundId: refund.id,
      error,
    });
    throw new OrderRefundError("MOLLIE_REFUND_UNCERTAIN_RETRY_SAME_REQUEST", 502);
  }
}

export async function createOrderRefund(
  input: CreateOrderRefundInput,
  admin: AdminUser,
  provider: OrderRefundProvider = mollieRefundProvider()
) {
  let refund = await prisma.orderRefund.findUnique({
    where: { idempotencyKey: input.requestId },
    include: refundInclude,
  });

  if (refund && !sameRequest(refund, input)) {
    throw new OrderRefundError("IDEMPOTENCY_CONFLICT", 409);
  }

  if (!refund) {
    try {
      refund = await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: input.orderId },
            include: {
              items: true,
              refunds: { include: { items: true } },
            },
          });
          if (!order) throw new OrderRefundError("ORDER_NOT_FOUND", 404);
          if (order.isTest) throw new OrderRefundError("TEST_ORDER_NOT_REFUNDABLE", 409);
          if (!order.molliePaymentId) {
            throw new OrderRefundError("MOLLIE_PAYMENT_ID_MISSING", 409);
          }
          if (order.status !== "PAID" && order.status !== "FULFILLED") {
            throw new OrderRefundError("ORDER_NOT_REFUNDABLE", 409);
          }

          const calculation = calculateOrderRefund({
            subtotalCents: order.subtotalCents,
            discountCents: order.discountCents,
            shippingCents: order.shippingCents,
            totalCents: order.totalCents,
            items: order.items,
            selections: input.selections,
            existingRefunds: order.refunds,
            includeShipping: input.includeShipping,
          });
          const created = await tx.orderRefund.create({
            data: {
              orderId: order.id,
              requestedByAdminUserId: admin.id,
              idempotencyKey: input.requestId,
              amountCents: calculation.amountCents,
              reason: normalizeReason(input.reason),
              includesShipping: input.includeShipping,
              items: { create: calculation.items },
            },
            include: refundInclude,
          });
          await recordAudit(tx, admin, "OrderRefund", created.id, "CREATE", null, {
            orderId: created.orderId,
            amountCents: created.amountCents,
            reason: created.reason,
            includesShipping: created.includesShipping,
            items: calculation.items,
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof OrderRefundError) throw error;
      if (error instanceof OrderRefundCalculationError) {
        throw new OrderRefundError(error.code, 409);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        const existing = await prisma.orderRefund.findUnique({
          where: { idempotencyKey: input.requestId },
          include: refundInclude,
        });
        if (existing && sameRequest(existing, input)) refund = existing;
        else throw new OrderRefundError("CONCURRENT_REFUND_CONFLICT", 409);
      } else {
        throw error;
      }
    }
  }

  if (!refund) throw new OrderRefundError("REFUND_REQUEST_NOT_FOUND", 500);
  if (refund.status === "FAILED" || refund.status === "CANCELED") {
    throw new OrderRefundError("REFUND_REQUEST_CLOSED", 409);
  }
  if (refund.mollieRefundId && refund.status !== "CREATING") return refund;
  const executed = await executeProviderRefund(refund, provider);
  if (executed.status === "FAILED" || executed.status === "CANCELED") {
    throw new OrderRefundError("REFUND_REQUEST_CLOSED", 409);
  }
  return executed;
}

export async function syncOrderRefundStatuses(
  orderId: string,
  provider: OrderRefundProvider = mollieRefundProvider()
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { refunds: true },
  });
  if (!order?.molliePaymentId || order.refunds.length === 0) return;

  const providerRefunds = await provider.listPaymentRefunds(order.molliePaymentId);
  await prisma.$transaction(async (tx) => {
    for (const localRefund of order.refunds) {
      const providerRefund =
        providerRefunds.find((candidate) => candidate.id === localRefund.mollieRefundId) ??
        providerRefunds.find((candidate) =>
          refundMetadataMatches(candidate.metadata, localRefund.id)
        );
      if (!providerRefund) continue;
      const status = mapMollieRefundStatus(providerRefund.status);
      if (localRefund.mollieRefundId !== providerRefund.id || localRefund.status !== status) {
        await tx.orderRefund.update({
          where: { id: localRefund.id },
          data: { mollieRefundId: providerRefund.id, status },
        });
      }
    }
  });

  const refunded = await prisma.orderRefund.aggregate({
    where: { orderId, status: "REFUNDED" },
    _sum: { amountCents: true },
  });
  if ((refunded._sum.amountCents ?? 0) >= order.totalCents) {
    await prisma.order.updateMany({
      where: { id: orderId, status: { in: ["PAID", "FULFILLED"] } },
      data: { status: "REFUNDED" },
    });
  }
}
