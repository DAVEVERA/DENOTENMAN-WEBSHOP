import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import { CartService } from "./cart.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { PublicApi } from "../auth/decorators/public-api.decorator";
import { AddToCartBodySchema } from "./dto/add-to-cart.dto";
import { UpdateCartLineBodySchema } from "./dto/update-cart-line.dto";
import { CheckoutBodySchema } from "./dto/checkout.dto";
import type { CheckoutResponse } from "./dto/checkout.dto";
import { CART_COOKIE_NAME } from "./cart.constants";
import type { Cart } from "@denotenman/schemas";

function getCartToken(req: FastifyRequest): string | null {
  const raw: unknown = req.cookies[CART_COOKIE_NAME];
  return typeof raw === "string" ? raw : null;
}

@ApiTags("cart")
@Controller("cart")
@Throttle({ public: { limit: 100, ttl: 60_000 } })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /v1/cart
   *
   * Returns the active cart for the current user or guest.
   * Guest carts are identified via HttpOnly cart_token cookie.
   * Auth is optional — @PublicApi() bypasses JWT guard.
   */
  @PublicApi()
  @Get()
  @ApiOperation({ summary: "Haal actieve winkelwagen op" })
  @ApiResponse({ status: 200, description: "Actieve winkelwagen" })
  async getCart(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Cart> {
    const guestToken = getCartToken(req);
    const { cart, token, isNew } = await this.cartService.resolveCart(
      user?.sub ?? null,
      null,
      guestToken,
    );

    if (isNew || (!guestToken && !user)) {
      res.setCookie(CART_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: this.cartService.cartCookieTtl,
        path: "/",
      });
    }

    return cart;
  }

  /**
   * POST /v1/cart/items
   *
   * Adds a product variant to the cart. Server-side pricing is enforced.
   * Any client-supplied price is ignored — variant price is read from the DB.
   */
  @PublicApi()
  @Post("items")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Voeg artikel toe aan winkelwagen" })
  @ApiBody({ schema: { type: "object" } })
  @ApiResponse({ status: 200, description: "Artikel toegevoegd" })
  @ApiResponse({ status: 422, description: "Onvoldoende voorraad" })
  async addItem(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() rawBody: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Cart> {
    const parsed = AddToCartBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldig verzoek",
          details: parsed.error.flatten(),
        },
      });
    }

    const guestToken = getCartToken(req);
    const {
      cart: currentCart,
      token,
      isNew,
    } = await this.cartService.resolveCart(user?.sub ?? null, null, guestToken);

    if (isNew || !guestToken) {
      res.setCookie(CART_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: this.cartService.cartCookieTtl,
        path: "/",
      });
    }

    return this.cartService.addLine(
      currentCart.id,
      currentCart.customerId,
      user?.sub ?? null,
      parsed.data.variantId,
      parsed.data.quantity,
    );
  }

  /**
   * PATCH /v1/cart/items/:itemId
   *
   * Updates the quantity of an existing cart line. Validates against current stock.
   */
  @PublicApi()
  @Patch("items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Wijzig hoeveelheid winkelwagen-artikel" })
  @ApiParam({ name: "itemId", type: "string", format: "uuid" })
  @ApiBody({ schema: { type: "object" } })
  @ApiResponse({ status: 200, description: "Hoeveelheid bijgewerkt" })
  @ApiResponse({ status: 422, description: "Onvoldoende voorraad" })
  async updateItem(
    @Req() req: FastifyRequest,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Cart> {
    const parsed = UpdateCartLineBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldig verzoek",
          details: parsed.error.flatten(),
        },
      });
    }

    const guestToken = getCartToken(req);
    const { cart: currentCart } = await this.cartService.resolveCart(
      user?.sub ?? null,
      null,
      guestToken,
    );

    return this.cartService.updateLine(
      currentCart.id,
      itemId,
      currentCart.customerId,
      user?.sub ?? null,
      parsed.data.quantity,
    );
  }

  /**
   * DELETE /v1/cart/items/:itemId
   *
   * Removes a line from the cart.
   */
  @PublicApi()
  @Delete("items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verwijder artikel uit winkelwagen" })
  @ApiParam({ name: "itemId", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Artikel verwijderd" })
  async removeItem(
    @Req() req: FastifyRequest,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Cart> {
    const guestToken = getCartToken(req);
    const { cart: currentCart } = await this.cartService.resolveCart(
      user?.sub ?? null,
      null,
      guestToken,
    );

    return this.cartService.removeLine(
      currentCart.id,
      itemId,
      currentCart.customerId,
      user?.sub ?? null,
    );
  }

  /**
   * DELETE /v1/cart
   *
   * Empties the cart (removes all lines, keeps the cart record).
   */
  @PublicApi()
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Leeg de winkelwagen" })
  @ApiResponse({ status: 200, description: "Winkelwagen geleegd" })
  async clearCart(
    @Req() req: FastifyRequest,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<Cart> {
    const guestToken = getCartToken(req);
    const { cart: currentCart } = await this.cartService.resolveCart(
      user?.sub ?? null,
      null,
      guestToken,
    );

    return this.cartService.clearCart(currentCart.id, currentCart.customerId, user?.sub ?? null);
  }

  /**
   * POST /v1/cart/checkout
   *
   * Converts the active cart into an Order (status=pending) and creates a Stripe
   * Checkout session. Returns { sessionId, url, orderId }.
   *
   * Requires authentication — guest checkout is out of scope for this sprint.
   */
  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Converteer winkelwagen naar bestelling en start betaling" })
  @ApiBody({ schema: { type: "object" } })
  @ApiResponse({ status: 201, description: "Stripe checkout sessie aangemaakt" })
  @ApiResponse({ status: 422, description: "Lege cart of onvoldoende voorraad" })
  async checkout(
    @Req() req: FastifyRequest,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckoutResponse> {
    const parsed = CheckoutBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldig verzoek",
          details: parsed.error.flatten(),
        },
      });
    }

    const guestToken = getCartToken(req);
    const { cart: currentCart } = await this.cartService.resolveCart(user.sub, null, guestToken);

    return this.cartService.checkout(
      currentCart.id,
      currentCart.customerId,
      user.sub,
      currentCart.customerId,
      parsed.data.successUrl,
      parsed.data.cancelUrl,
    );
  }
}
