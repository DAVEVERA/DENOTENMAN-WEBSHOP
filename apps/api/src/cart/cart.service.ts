import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import { CartRepository, type CartWithLines } from "./repositories/cart.repository";
import { OrderRepository } from "../orders/repositories/order.repository";
import { StripeService } from "../stripe/stripe.service";
import { CART_COOKIE_TTL_SECONDS, CART_EXPIRY_MS } from "./cart.constants";
import type { Cart } from "@denotenman/schemas";
import type { CheckoutResponse } from "./dto/checkout.dto";
import type { CartLine } from "@denotenman/prisma";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

function mapCartToDto(cart: CartWithLines): Cart {
  return {
    id: cart.id,
    customerId: cart.customerId,
    token: cart.token,
    currency: cart.currency,
    expiresAt: cart.expiresAt,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    lines: cart.lines.map((l: CartLine) => ({
      id: l.id,
      cartId: l.cartId,
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  };
}

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly orderRepo: OrderRepository,
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(CartService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Resolves the active cart for a request.
   * - Authenticated user: first try cart linked to customerId, then fall back to
   *   token cart and link it, then create a new cart.
   * - Guest: resolve by token from cookie, or create a fresh one.
   *
   * Returns { cart, token, isNew } — caller must set/clear the cookie when isNew=true.
   */
  async resolveCart(
    userId: string | null,
    customerId: string | null,
    guestToken: string | null,
  ): Promise<{ cart: Cart; token: string; isNew: boolean }> {
    let dbCart: CartWithLines | null = null;
    let isNew = false;

    if (customerId) {
      dbCart = await this.cartRepo.findByCustomerId(customerId);

      if (!dbCart && guestToken) {
        const guestCart = await this.cartRepo.findByToken(guestToken);
        if (guestCart) {
          dbCart = await this.cartRepo.linkCustomer(guestCart.id, customerId);
        }
      }

      if (!dbCart) {
        dbCart = await this.cartRepo.create({
          token: generateToken(),
          customerId,
          currency: "EUR",
          expiresAt: new Date(Date.now() + CART_EXPIRY_MS),
        });
        isNew = true;
      }
    } else {
      if (guestToken) {
        dbCart = await this.cartRepo.findByToken(guestToken);
      }

      if (!dbCart) {
        const token = generateToken();
        dbCart = await this.cartRepo.create({
          token,
          customerId: null,
          currency: "EUR",
          expiresAt: new Date(Date.now() + CART_EXPIRY_MS),
        });
        isNew = true;
      }
    }

    // userId is accepted but only used for tracing; cart resolution is by customerId.
    void userId;

    return { cart: mapCartToDto(dbCart), token: dbCart.token, isNew };
  }

  async mergeGuestCartOnLogin(guestToken: string, customerId: string): Promise<void> {
    const guestCart = await this.cartRepo.findByToken(guestToken);
    if (!guestCart) {
      return;
    }

    const userCart = await this.cartRepo.findByCustomerId(customerId);

    if (!userCart) {
      await this.cartRepo.linkCustomer(guestCart.id, customerId);
      return;
    }

    await this.cartRepo.mergeGuestCart(guestCart.id, userCart.id);
    this.logger.info({ customerId }, "Guest cart merged into user cart");
  }

  async addLine(
    cartId: string,
    cartOwnerId: string | null,
    requestingUserId: string | null,
    variantId: string,
    quantity: number,
  ): Promise<Cart> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw new NotFoundException({
        error: { code: "CART_NOT_FOUND", message: "Cart niet gevonden" },
      });
    }

    this.assertCartAccess(cart, cartOwnerId, requestingUserId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId, deletedAt: null },
      include: { product: { select: { id: true, name: true, status: true } } },
    });

    if (!variant) {
      throw new NotFoundException({
        error: { code: "VARIANT_NOT_FOUND", message: `Variant niet gevonden: ${variantId}` },
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

    const existingLine = cart.lines.find((l) => l.variantId === variantId);
    const newQty = existingLine ? existingLine.quantity + quantity : quantity;

    if (newQty > variant.stockQuantity) {
      throw new UnprocessableEntityException({
        error: {
          code: "INSUFFICIENT_STOCK",
          message: `Onvoldoende voorraad: beschikbaar ${variant.stockQuantity}, aangevraagd ${newQty}`,
        },
      });
    }

    const updated = await this.cartRepo.upsertLine(cartId, variant.product.id, variantId, newQty);
    return mapCartToDto(updated);
  }

  async updateLine(
    cartId: string,
    lineId: string,
    cartOwnerId: string | null,
    requestingUserId: string | null,
    quantity: number,
  ): Promise<Cart> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw new NotFoundException({
        error: { code: "CART_NOT_FOUND", message: "Cart niet gevonden" },
      });
    }

    this.assertCartAccess(cart, cartOwnerId, requestingUserId);

    const line = cart.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException({
        error: { code: "CART_LINE_NOT_FOUND", message: "Cart-regel niet gevonden" },
      });
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: line.variantId, deletedAt: null },
    });

    if (!variant) {
      throw new NotFoundException({
        error: { code: "VARIANT_NOT_FOUND", message: `Variant niet gevonden: ${line.variantId}` },
      });
    }

    if (quantity > variant.stockQuantity) {
      throw new UnprocessableEntityException({
        error: {
          code: "INSUFFICIENT_STOCK",
          message: `Onvoldoende voorraad: beschikbaar ${variant.stockQuantity}, aangevraagd ${quantity}`,
        },
      });
    }

    const updated = await this.cartRepo.updateLine(lineId, quantity);
    return mapCartToDto(updated);
  }

  async removeLine(
    cartId: string,
    lineId: string,
    cartOwnerId: string | null,
    requestingUserId: string | null,
  ): Promise<Cart> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw new NotFoundException({
        error: { code: "CART_NOT_FOUND", message: "Cart niet gevonden" },
      });
    }

    this.assertCartAccess(cart, cartOwnerId, requestingUserId);

    const line = cart.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException({
        error: { code: "CART_LINE_NOT_FOUND", message: "Cart-regel niet gevonden" },
      });
    }

    const updated = await this.cartRepo.removeLine(lineId);
    return mapCartToDto(updated);
  }

  async clearCart(
    cartId: string,
    cartOwnerId: string | null,
    requestingUserId: string | null,
  ): Promise<Cart> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw new NotFoundException({
        error: { code: "CART_NOT_FOUND", message: "Cart niet gevonden" },
      });
    }

    this.assertCartAccess(cart, cartOwnerId, requestingUserId);

    const updated = await this.cartRepo.clearLines(cartId);
    return mapCartToDto(updated);
  }

  /**
   * Converts the cart to an Order and creates a Stripe Checkout session.
   *
   * Concurrency strategy: SELECT ... FOR UPDATE row lock on CartLine rows inside
   * a $transaction. The lock prevents two simultaneous checkouts from reading the
   * same cart state. No extra schema column is required — Postgres row-level locks
   * via raw SQL are sufficient and leave no database footprint.
   */
  async checkout(
    cartId: string,
    cartOwnerId: string | null,
    requestingUserId: string | null,
    customerId: string | null,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutResponse> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw new NotFoundException({
        error: { code: "CART_NOT_FOUND", message: "Cart niet gevonden" },
      });
    }

    this.assertCartAccess(cart, cartOwnerId, requestingUserId);

    if (cart.lines.length === 0) {
      throw new UnprocessableEntityException({
        error: { code: "CART_EMPTY", message: "De winkelwagen is leeg" },
      });
    }

    const variantIds = cart.lines.map((l) => l.variantId);

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null },
      include: { product: { select: { id: true, name: true, status: true } } },
    });

    if (variants.length !== variantIds.length) {
      throw new UnprocessableEntityException({
        error: {
          code: "VARIANT_UNAVAILABLE",
          message: "Een of meer varianten zijn niet meer beschikbaar",
        },
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotalCents = 0;
    const lineItems: { variantId: string; quantity: number }[] = [];

    for (const line of cart.lines) {
      const variant = variantMap.get(line.variantId);
      if (!variant) {
        throw new UnprocessableEntityException({
          error: {
            code: "VARIANT_UNAVAILABLE",
            message: `Variant niet beschikbaar: ${line.variantId}`,
          },
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

      if (line.quantity > variant.stockQuantity) {
        throw new UnprocessableEntityException({
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Onvoldoende voorraad voor ${variant.name}: beschikbaar ${variant.stockQuantity}`,
          },
        });
      }

      subtotalCents += variant.priceCents * line.quantity;
      lineItems.push({ variantId: line.variantId, quantity: line.quantity });
    }

    const orderNumber = generateOrderNumber();

    const orderId = await this.prisma.$transaction(async (tx) => {
      // Row-lock all cart lines to prevent concurrent checkouts on the same cart.
      await this.cartRepo.lockCartLinesForUpdate(cartId, tx);

      const orderLines = cart.lines.map((line) => {
        const variant = variantMap.get(line.variantId);
        if (!variant) {
          throw new Error(`Variant not in map: ${line.variantId}`);
        }
        return {
          productId: variant.product.id,
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          unitPriceCents: variant.priceCents,
          quantity: line.quantity,
          totalCents: variant.priceCents * line.quantity,
        };
      });

      const order = await this.orderRepo.create(
        {
          orderNumber,
          customerId: customerId ?? null,
          currency: cart.currency,
          subtotalCents,
          shippingCents: 0,
          taxCents: 0,
          totalCents: subtotalCents,
          lines: orderLines,
        },
        tx,
      );

      return order.id;
    });

    // Create Stripe session outside the transaction (external call).
    const session = await this.stripeService.createCheckoutSession(
      {
        cartId,
        lineItems,
        successUrl,
        cancelUrl,
      },
      requestingUserId ?? "guest",
    );

    // Persist the session id so the webhook can locate this order.
    await this.orderRepo.updateStripeSession(orderId, session.sessionId);

    this.logger.info({ orderId, stripeSessionId: session.sessionId }, "Checkout initiated");

    return { sessionId: session.sessionId, url: session.url, orderId };
  }

  get cartCookieTtl(): number {
    return CART_COOKIE_TTL_SECONDS;
  }

  private assertCartAccess(
    cart: CartWithLines,
    cartOwnerId: string | null,
    requestingUserId: string | null,
  ): void {
    if (!cartOwnerId && !requestingUserId) {
      return; // guest cart without authenticated user — allow
    }

    // Guest cart (no owner attached) is accessible by anyone in the session.
    if (!cart.customerId) {
      return;
    }

    if (cartOwnerId && cart.customerId !== cartOwnerId) {
      throw new ForbiddenException({
        error: { code: "FORBIDDEN", message: "Geen toegang tot deze winkelwagen" },
      });
    }
  }
}
