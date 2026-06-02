import { Module } from "@nestjs/common";
import StripeSDK from "stripe";
import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { StripeEventRepository } from "./repositories/stripe-event.repository";
import { STRIPE_CLIENT } from "./stripe.constants";
import { env } from "../env";
import { OrdersModule } from "../orders/orders.module";

/**
 * StripeModule wires up the Stripe SDK singleton, service, controller, and
 * the event repository. The SDK instance is provided via a factory so the
 * secret key is validated at startup via the env singleton.
 *
 * OrdersModule is imported so StripeService can inject OrderStateService for
 * webhook-driven order-state mutations (ADR 0008). OrderStateService is the
 * narrow surface — it avoids a circular dependency with CartModule.
 */
@Module({
  imports: [OrdersModule],
  controllers: [StripeController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (): InstanceType<typeof StripeSDK> => {
        // STRIPE_SECRET_KEY is required in production; optional in development.
        // parseEnv already enforced this constraint at boot — we assert here
        // only to satisfy TypeScript's non-nullable requirement.
        const secretKey = env.STRIPE_SECRET_KEY ?? "";
        return new StripeSDK(secretKey, {
          apiVersion: "2026-04-22.dahlia",
          typescript: true,
        });
      },
    },
    StripeService,
    StripeEventRepository,
  ],
  exports: [StripeService],
})
export class StripeModule {}
