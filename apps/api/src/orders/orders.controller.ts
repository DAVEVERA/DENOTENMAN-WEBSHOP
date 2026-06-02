import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { OrdersService } from "./orders.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { ListOrdersQuerySchema } from "./dto/list-orders.dto";
import { UpdateOrderStatusDtoSchema } from "./dto/update-order-status.dto";
import type { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import type { Order } from "@denotenman/schemas";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * GET /v1/orders
   *
   * Lists orders for the authenticated user.
   * Admins (owner/admin/staff) see all orders when the role check passes.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Lijst van bestellingen" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiResponse({ status: 200, description: "Lijst van bestellingen" })
  async listOrders(
    @Query() rawQuery: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
    const parsed = ListOrdersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige query-parameters",
          details: parsed.error.flatten(),
        },
      });
    }

    const isAdmin = ["owner", "admin", "staff"].includes(user.role);

    if (isAdmin) {
      return this.ordersService.findAllAdmin(parsed.data);
    }

    return this.ordersService.findByUser(user.sub, parsed.data);
  }

  /**
   * GET /v1/orders/by-session/:sessionId
   *
   * Lookup by Stripe session id — used on the checkout-success page.
   * Only the owning customer may retrieve the order this way.
   */
  @Get("by-session/:sessionId")
  @HttpCode(HttpStatus.OK)
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Haal bestelling op via Stripe sessie-id" })
  @ApiParam({ name: "sessionId", type: "string" })
  @ApiResponse({ status: 200, description: "Bestelling" })
  @ApiResponse({ status: 404, description: "Bestelling niet gevonden" })
  async getBySession(
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Order> {
    return this.ordersService.findByStripeSession(sessionId, user.sub);
  }

  /**
   * GET /v1/orders/:id
   *
   * Returns a single order. Customers only see their own orders (404 on mismatch).
   * Admins see any order.
   *
   * Route is registered after by-session to avoid path conflicts.
   */
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ public: { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: "Haal bestelling op via id" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Bestelling" })
  @ApiResponse({ status: 404, description: "Bestelling niet gevonden" })
  async getOrder(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Order> {
    const isAdmin = ["owner", "admin", "staff"].includes(user.role);
    return this.ordersService.findById(id, user.sub, isAdmin);
  }

  /**
   * PATCH /v1/orders/:id/status
   *
   * Admin-only endpoint to update an order's status.
   */
  @Patch(":id/status")
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @Roles("owner", "admin", "staff")
  @ApiOperation({ summary: "Bestelstatus bijwerken (admin)" })
  @ApiParam({ name: "id", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Bijgewerkte bestelling" })
  @ApiResponse({ status: 404, description: "Bestelling niet gevonden" })
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() rawBody: UpdateOrderStatusDto,
  ): Promise<Order> {
    const parsed = UpdateOrderStatusDtoSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige statuswaarde",
          details: parsed.error.flatten(),
        },
      });
    }
    return this.ordersService.updateStatus(id, parsed.data.status);
  }

  /**
   * GET /v1/orders/admin (admin-only list — explicit roles guard via decorator)
   * Kept inline above via role check in listOrders.
   */
  @Get("admin/all")
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @Roles("owner", "admin", "staff")
  @ApiOperation({ summary: "Alle bestellingen (admin)" })
  @ApiResponse({ status: 200, description: "Alle bestellingen" })
  async adminListOrders(
    @Query() rawQuery: unknown,
  ): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
    const parsed = ListOrdersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige query-parameters",
          details: parsed.error.flatten(),
        },
      });
    }
    return this.ordersService.findAllAdmin(parsed.data);
  }
}
