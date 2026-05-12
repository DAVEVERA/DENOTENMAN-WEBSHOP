import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { OrderRepository, type OrderWithLines } from "./repositories/order.repository";
import type { Order } from "@denotenman/schemas";
import type { Prisma } from "@denotenman/prisma";

type TransactionClient = Prisma.TransactionClient;

export interface ListOrdersFilters {
  status?: string;
  page?: number;
  pageSize?: number;
}

function mapOrderToDto(o: OrderWithLines): Order {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    guestEmail: o.guestEmail,
    status: o.status,
    currency: o.currency,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    totalCents: o.totalCents,
    shippingAddressId: o.shippingAddressId,
    billingAddressId: o.billingAddressId,
    stripeSessionId: o.stripeSessionId,
    stripePaymentIntent: o.stripePaymentIntent,
    paidAt: o.paidAt,
    fulfilledAt: o.fulfilledAt,
    cancelledAt: o.cancelledAt,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    lines: o.lines.map((l) => ({
      id: l.id,
      orderId: l.orderId,
      productId: l.productId,
      variantId: l.variantId,
      productName: l.productName,
      variantName: l.variantName,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      totalCents: l.totalCents,
      createdAt: l.createdAt,
    })),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepo: OrderRepository,
    @InjectPinoLogger(OrdersService.name) private readonly logger: PinoLogger,
  ) {}

  async findByUser(
    userId: string,
    filters: ListOrdersFilters,
  ): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const { items, total } = await this.orderRepo.list({
      customerId: userId,
      status: filters.status,
      page,
      pageSize,
    });

    return { items: items.map(mapOrderToDto), total, page, pageSize };
  }

  async findAllAdmin(
    filters: ListOrdersFilters,
  ): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const { items, total } = await this.orderRepo.list({
      status: filters.status,
      page,
      pageSize,
    });

    return { items: items.map(mapOrderToDto), total, page, pageSize };
  }

  /**
   * Retrieves a single order.
   *
   * Security: returns 404 for orders that don't belong to requestingUserId
   * (unless caller is admin) to avoid leaking existence information.
   */
  async findById(id: string, requestingUserId: string, isAdmin: boolean): Promise<Order> {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException({
        error: { code: "ORDER_NOT_FOUND", message: "Bestelling niet gevonden" },
      });
    }

    if (!isAdmin && order.customerId !== requestingUserId) {
      // Return 404, not 403, to avoid leaking existence.
      throw new NotFoundException({
        error: { code: "ORDER_NOT_FOUND", message: "Bestelling niet gevonden" },
      });
    }

    return mapOrderToDto(order);
  }

  async findByStripeSession(sessionId: string, requestingUserId: string): Promise<Order> {
    const order = await this.orderRepo.findByStripeSessionId(sessionId);

    if (!order) {
      throw new NotFoundException({
        error: { code: "ORDER_NOT_FOUND", message: "Bestelling niet gevonden" },
      });
    }

    if (order.customerId !== requestingUserId) {
      throw new NotFoundException({
        error: { code: "ORDER_NOT_FOUND", message: "Bestelling niet gevonden" },
      });
    }

    return mapOrderToDto(order);
  }

  /**
   * Marks an order as paid. Accepts an optional transaction client so the
   * mutation is atomic with the StripeEvent insert in the webhook handler.
   *
   * TODO(worker): enqueue confirmation email after worker is available in sprint 3.
   */
  async markAsPaid(
    stripeSessionId: string,
    paymentIntentId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.orderRepo.markAsPaid(stripeSessionId, paymentIntentId, tx);
    this.logger.info({ stripeSessionId }, "Order marked as paid");
  }

  /** Marks an order cancelled after payment failure. */
  async markAsFailed(stripeSessionId: string, tx?: TransactionClient): Promise<void> {
    await this.orderRepo.markAsFailed(stripeSessionId, tx);
    this.logger.info({ stripeSessionId }, "Order marked as failed");
  }

  /** Marks an order refunded after a charge refund. */
  async markAsRefunded(paymentIntentId: string, tx?: TransactionClient): Promise<void> {
    await this.orderRepo.markAsRefunded(paymentIntentId, tx);
    this.logger.info({ paymentIntentId }, "Order marked as refunded");
  }
}
