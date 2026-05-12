import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Throttle } from "@nestjs/throttler";
import { PublicApi } from "../auth/decorators/public-api.decorator";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { StripeService } from "./stripe.service";
import { RawBody } from "./decorators/raw-body.decorator";
import {
  CreateCheckoutSessionSchema,
  type CreateCheckoutSessionDto,
  type CheckoutSessionResponse,
} from "./dto/create-checkout-session.dto";

@ApiTags("stripe")
@Controller("stripe")
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    @InjectPinoLogger(StripeController.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * POST /v1/stripe/checkout
   *
   * Creates a Stripe Checkout session from server-side resolved pricing.
   * Returns the session id and redirect URL. The storefront navigates to `url`.
   *
   * Auth: JWT required (authenticated customers only).
   * Rate limit: auth bucket — 30 rpm (same as admin routes).
   */
  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Maak Stripe Checkout sessie aan" })
  @ApiBody({ schema: { type: "object" } })
  @ApiResponse({ status: 201, description: "Checkout sessie aangemaakt" })
  @ApiResponse({ status: 422, description: "Onvoldoende voorraad of valuta-conflict" })
  async createCheckoutSession(
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckoutSessionResponse> {
    const parsed = CreateCheckoutSessionSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldig verzoek",
          details: parsed.error.flatten(),
        },
      });
    }

    const dto: CreateCheckoutSessionDto = parsed.data;
    return this.stripeService.createCheckoutSession(dto, user.sub);
  }

  /**
   * POST /v1/stripe/webhook
   *
   * Stripe webhook endpoint. Exempt from JWT auth and CSRF (ADR 0009).
   * Auth is the HMAC signature in `stripe-signature`.
   *
   * Raw body parsing is configured in main.ts via addContentTypeParser so
   * Stripe's signature verification has access to the original bytes.
   *
   * Rate limit: none applied (signature is the gate; Stripe IPs vary).
   */
  @PublicApi()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stripe webhook ontvanger (intern)" })
  @ApiHeader({ name: "stripe-signature", required: true })
  @ApiResponse({ status: 200, description: "Event verwerkt of idempotent overgeslagen" })
  @ApiResponse({ status: 400, description: "Ongeldige handtekening" })
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers("stripe-signature") signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException({
        error: { code: "STRIPE_SIGNATURE_MISSING", message: "Stripe-Signature header ontbreekt" },
      });
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    const { handled } = await this.stripeService.processWebhookEvent(event);

    this.logger.info(
      { eventId: event.id, eventType: event.type, handled },
      "Stripe webhook verwerkt",
    );

    return { received: true };
  }
}
