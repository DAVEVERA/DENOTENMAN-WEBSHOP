import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import StripeSDK from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core";
import type { Checkout } from "stripe/cjs/resources/Checkout/Sessions";
import { PrismaService } from "../prisma/prisma.service";
import { StripeEventRepository } from "./repositories/stripe-event.repository";
import { STRIPE_CLIENT, SUPPORTED_EVENT_TYPES } from "./stripe.constants";
import { env } from "../env";
import { handleCheckoutSessionCompleted } from "./handlers/checkout-session-completed.handler";
import { handlePaymentIntentPaymentFailed } from "./handlers/payment-intent-payment-failed.handler";
import { handleChargeRefunded } from "./handlers/charge-refunded.handler";
import type {
  CreateCheckoutSessionDto,
  CheckoutSessionResponse,
} from "./dto/create-checkout-session.dto";
import type { PrismaTransaction } from "./repositories/stripe-event.repository";
import { OrderStateService } from "../orders/order-state.service";

@Injectable()
export class StripeService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: InstanceType<typeof StripeSDK>,
    private readonly prisma: PrismaService,
    private readonly stripeEventRepo: StripeEventRepository,
    private readonly orderStateService: OrderStateService,
    @InjectPinoLogger(StripeService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Creates a Stripe Checkout session from server-side resolved pricing.
   *
   * Security contract:
   * - Prices and currency are read from the DB via productVariant — client-
   *   supplied amounts are never accepted.
   * - Quantity is validated against `stockQuantity`; exceeding stock → 422.
   * - Currency disagreement between variants in the same cart → 422.
   */
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    userId: string,
  ): Promise<CheckoutSessionResponse> {
    const variantIds = dto.lineItems.map((li) => li.variantId);

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null },
      include: { product: { select: { name: true, status: true } } },
    });

    // Validate that all requested variants exist and belong to active products.
    if (variants.length !== variantIds.length) {
      const foundIds = new Set(variants.map((v) => v.id));
      const missing = variantIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException({
        error: {
          code: "VARIANT_NOT_FOUND",
          message: `Variant niet gevonden: ${missing.join(", ")}`,
        },
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Validate stock and currency consistency.
    const currencies = new Set<string>();

    for (const li of dto.lineItems) {
      const variant = variantMap.get(li.variantId);

      if (!variant) {
        throw new NotFoundException({
          error: { code: "VARIANT_NOT_FOUND", message: `Variant niet gevonden: ${li.variantId}` },
        });
      }

      if (variant.product.status !== "active") {
        throw new UnprocessableEntityException({
          error: {
            code: "PRODUCT_NOT_ACTIVE",
            message: `Product is niet actief: ${variant.product.name}`,
          },
        });
      }

      if (li.quantity > variant.stockQuantity) {
        throw new UnprocessableEntityException({
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Onvoldoende voorraad voor variant ${variant.id}: beschikbaar ${variant.stockQuantity}, aangevraagd ${li.quantity}`,
          },
        });
      }

      currencies.add(variant.currency.toLowerCase());
    }

    if (currencies.size > 1) {
      throw new UnprocessableEntityException({
        error: {
          code: "CURRENCY_MISMATCH",
          message: "Alle varianten in een checkout moeten dezelfde valuta hebben",
        },
      });
    }

    const currency = [...currencies][0] ?? "eur";

    // Build Stripe line_items using DB prices — never client-supplied amounts.
    const stripeLineItems: Checkout.SessionCreateParams.LineItem[] = dto.lineItems.map((li) => {
      const variant = variantMap.get(li.variantId);

      if (!variant) {
        throw new NotFoundException({
          error: {
            code: "VARIANT_NOT_FOUND",
            message: `Variant niet gevonden: ${li.variantId}`,
          },
        });
      }

      return {
        price_data: {
          currency,
          unit_amount: variant.priceCents,
          product_data: {
            name: `${variant.product.name} — ${variant.name}`,
          },
        },
        quantity: li.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: stripeLineItems,
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata: {
        cartId: dto.cartId,
        userId,
      },
    });

    if (!session.url) {
      throw new UnprocessableEntityException({
        error: { code: "STRIPE_SESSION_NO_URL", message: "Stripe gaf geen redirect URL terug" },
      });
    }

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Verifies the Stripe webhook signature and parses the event.
   * Throws BadRequestException (400) on signature failure — per ADR 0008.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET ?? "",
      );
    } catch {
      throw new BadRequestException({
        error: { code: "STRIPE_SIGNATURE_INVALID", message: "Ongeldige Stripe handtekening" },
      });
    }
  }

  /**
   * Processes a verified Stripe event idempotently per ADR 0008.
   *
   * Flow:
   *   1. Open Prisma transaction.
   *   2. INSERT StripeEvent — unique on event.id.
   *   3a. Duplicate → commit (no-op) → return { handled: false }.
   *   3b. New → run handler → commit → return { handled: true }.
   *
   * Unknown event types are skipped (200, no error) — forward-compatibility.
   */
  async processWebhookEvent(event: Stripe.Event): Promise<{ handled: boolean }> {
    const isSupported = (SUPPORTED_EVENT_TYPES as readonly string[]).includes(event.type);

    if (!isSupported) {
      this.logger.info({ eventType: event.type, eventId: event.id }, "Stripe event type skipped");
      return { handled: false };
    }

    let handled = false;

    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      const result = await this.stripeEventRepo.recordEvent(event, tx);

      if (result.duplicate) {
        this.logger.info({ eventId: event.id }, "Stripe event duplicate — skipping");
        return;
      }

      await this.dispatchHandler(event.type, event, tx);
      handled = true;
    });

    return { handled };
  }

  private async dispatchHandler(
    eventType: string,
    event: Stripe.Event,
    tx: PrismaTransaction,
  ): Promise<void> {
    switch (eventType) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event, tx, this.orderStateService);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentPaymentFailed(event, tx, this.orderStateService);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event, tx, this.orderStateService);
        break;

      default:
        this.logger.warn({ eventType }, "No handler for supported event type");
    }
  }
}
