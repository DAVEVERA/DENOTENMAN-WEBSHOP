import { Module } from "@nestjs/common";
import StripeSDK from "stripe";
import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { StripeEventRepository } from "./repositories/stripe-event.repository";
import { STRIPE_CLIENT } from "./stripe.constants";
import { assertEnv } from "../auth/env";

/**
 * StripeModule wires up the Stripe SDK singleton, service, controller, and
 * the event repository. The SDK instance is provided via a factory so the
 * secret key is validated at startup via assertEnv.
 */
@Module({
  controllers: [StripeController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      useFactory: (): InstanceType<typeof StripeSDK> => {
        const secretKey = assertEnv("STRIPE_SECRET_KEY");
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
