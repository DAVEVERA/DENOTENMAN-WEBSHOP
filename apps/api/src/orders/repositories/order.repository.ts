import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma, Order, OrderLine } from "@denotenman/prisma";

export type OrderWithLines = Order & { lines: OrderLine[] };

type TransactionClient = Prisma.TransactionClient;

const ORDER_INCLUDE = { lines: true } as const;

export interface CreateOrderData {
  orderNumber: string;
  customerId?: string | null;
  guestEmail?: string | null;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string | null;
  lines: {
    productId: string;
    variantId: string;
    productName: string;
    variantName: string;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
  }[];
}

export interface ListOrdersOptions {
  customerId?: string;
  status?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrderData, tx?: TransactionClient): Promise<OrderWithLines> {
    const client = tx ?? this.prisma;
    return client.order.create({
      data: {
        orderNumber: data.orderNumber,
        customerId: data.customerId ?? null,
        guestEmail: data.guestEmail ?? null,
        currency: data.currency,
        subtotalCents: data.subtotalCents,
        shippingCents: data.shippingCents,
        taxCents: data.taxCents,
        totalCents: data.totalCents,
        notes: data.notes ?? null,
        lines: {
          create: data.lines,
        },
      },
      include: ORDER_INCLUDE,
    });
  }

  async findById(id: string, tx?: TransactionClient): Promise<OrderWithLines | null> {
    const client = tx ?? this.prisma;
    return client.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  }

  async findByStripeSessionId(
    stripeSessionId: string,
    tx?: TransactionClient,
  ): Promise<OrderWithLines | null> {
    const client = tx ?? this.prisma;
    return client.order.findUnique({ where: { stripeSessionId }, include: ORDER_INCLUDE });
  }

  async findByStripePaymentIntent(
    paymentIntentId: string,
    tx?: TransactionClient,
  ): Promise<OrderWithLines | null> {
    const client = tx ?? this.prisma;
    return client.order.findFirst({
      where: { stripePaymentIntent: paymentIntentId },
      include: ORDER_INCLUDE,
    });
  }

  async list(opts: ListOrdersOptions): Promise<{ items: OrderWithLines[]; total: number }> {
    const where: Prisma.OrderWhereInput = {};

    if (opts.customerId) {
      where.customerId = opts.customerId;
    }
    if (opts.status) {
      where.status = opts.status as Order["status"];
    }

    const skip = (opts.page - 1) * opts.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: opts.pageSize,
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async updateStripeSession(
    orderId: string,
    stripeSessionId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.order.update({
      where: { id: orderId },
      data: { stripeSessionId },
    });
  }

  async markAsPaid(
    stripeSessionId: string,
    paymentIntentId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.order.updateMany({
      where: { stripeSessionId, status: "pending" },
      data: { status: "paid", stripePaymentIntent: paymentIntentId, paidAt: new Date() },
    });
  }

  async markAsFailed(stripeSessionId: string, tx?: TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.order.updateMany({
      where: { stripeSessionId, status: { in: ["pending"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
  }

  async markAsRefunded(paymentIntentId: string, tx?: TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.order.updateMany({
      where: { stripePaymentIntent: paymentIntentId, status: { in: ["paid", "fulfilled"] } },
      data: { status: "refunded" },
    });
  }
}
