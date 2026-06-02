import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { OrderRepository } from "./repositories/order.repository";
import type { Prisma } from "@denotenman/prisma";

type TransactionClient = Prisma.TransactionClient;

/**
 * Thin service that owns order-state transitions triggered by Stripe webhooks.
 * Kept separate from OrdersService to avoid circular imports between StripeModule
 * and OrdersModule — StripeModule imports only this service.
 */
@Injectable()
export class OrderStateService {
  constructor(
    private readonly orderRepo: OrderRepository,
    @InjectPinoLogger(OrderStateService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Marks an order as paid. Runs within the caller-supplied transaction so the
   * state change is atomic with the StripeEvent insert (ADR 0008).
   *
   * TODO(worker): enqueue confirmation email after the worker is available in sprint 3.
   */
  async markAsPaid(
    stripeSessionId: string,
    paymentIntentId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.orderRepo.markAsPaid(stripeSessionId, paymentIntentId, tx);
    this.logger.info({ stripeSessionId }, "Order marked as paid");
  }

  /** Marks an order as cancelled after a payment failure. */
  async markAsFailed(stripeSessionId: string, tx?: TransactionClient): Promise<void> {
    await this.orderRepo.markAsFailed(stripeSessionId, tx);
    this.logger.info({ stripeSessionId }, "Order marked as failed/cancelled");
  }

  /** Marks an order as refunded after a charge refund. */
  async markAsRefunded(paymentIntentId: string, tx?: TransactionClient): Promise<void> {
    await this.orderRepo.markAsRefunded(paymentIntentId, tx);
    this.logger.info({ paymentIntentId }, "Order marked as refunded");
  }
}
