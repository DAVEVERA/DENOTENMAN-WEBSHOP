import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma, Cart, CartLine } from "@denotenman/prisma";

export type CartWithLines = Cart & { lines: CartLine[] };

type TransactionClient = Prisma.TransactionClient;

const CART_INCLUDE = {
  lines: true,
} as const;

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByToken(token: string): Promise<CartWithLines | null> {
    return this.prisma.cart.findUnique({
      where: { token },
      include: CART_INCLUDE,
    });
  }

  async findByCustomerId(customerId: string): Promise<CartWithLines | null> {
    return this.prisma.cart.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: CART_INCLUDE,
    });
  }

  async findById(id: string, tx?: TransactionClient): Promise<CartWithLines | null> {
    const client = tx ?? this.prisma;
    return client.cart.findUnique({
      where: { id },
      include: CART_INCLUDE,
    });
  }

  async create(data: {
    token: string;
    customerId?: string | null;
    currency: string;
    expiresAt: Date;
  }): Promise<CartWithLines> {
    return this.prisma.cart.create({
      data,
      include: CART_INCLUDE,
    });
  }

  async linkCustomer(cartId: string, customerId: string): Promise<CartWithLines> {
    return this.prisma.cart.update({
      where: { id: cartId },
      data: { customerId },
      include: CART_INCLUDE,
    });
  }

  async upsertLine(
    cartId: string,
    productId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartWithLines> {
    const existing = await this.prisma.cartLine.findFirst({
      where: { cartId, variantId },
    });

    if (existing) {
      await this.prisma.cartLine.update({
        where: { id: existing.id },
        data: { quantity },
      });
    } else {
      await this.prisma.cartLine.create({
        data: { cartId, productId, variantId, quantity },
      });
    }

    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  async updateLine(lineId: string, quantity: number): Promise<CartWithLines> {
    const line = await this.prisma.cartLine.findUniqueOrThrow({ where: { id: lineId } });
    await this.prisma.cartLine.update({
      where: { id: lineId },
      data: { quantity },
    });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: line.cartId },
      include: CART_INCLUDE,
    });
  }

  async removeLine(lineId: string): Promise<CartWithLines> {
    const line = await this.prisma.cartLine.findUniqueOrThrow({ where: { id: lineId } });
    await this.prisma.cartLine.delete({ where: { id: lineId } });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: line.cartId },
      include: CART_INCLUDE,
    });
  }

  async clearLines(cartId: string): Promise<CartWithLines> {
    await this.prisma.cartLine.deleteMany({ where: { cartId } });
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
  }

  async findLineById(lineId: string): Promise<CartLine | null> {
    return this.prisma.cartLine.findUnique({ where: { id: lineId } });
  }

  /** Lock all CartLine rows for a cart inside a transaction using raw SQL. */
  async lockCartLinesForUpdate(cartId: string, tx: TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "CartLine" WHERE "cartId" = ${cartId}::uuid FOR UPDATE`;
  }

  async mergeGuestCart(guestCartId: string, userCartId: string): Promise<void> {
    const guestLines = await this.prisma.cartLine.findMany({ where: { cartId: guestCartId } });

    for (const gl of guestLines) {
      const exists = await this.prisma.cartLine.findFirst({
        where: { cartId: userCartId, variantId: gl.variantId },
      });

      if (!exists) {
        await this.prisma.cartLine.create({
          data: {
            cartId: userCartId,
            productId: gl.productId,
            variantId: gl.variantId,
            quantity: gl.quantity,
          },
        });
      }
    }

    await this.prisma.cartLine.deleteMany({ where: { cartId: guestCartId } });
    await this.prisma.cart.delete({ where: { id: guestCartId } });
  }
}
