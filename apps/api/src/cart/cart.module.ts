import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { CartRepository } from "./repositories/cart.repository";
import { OrdersModule } from "../orders/orders.module";
import { StripeModule } from "../stripe/stripe.module";

@Module({
  imports: [OrdersModule, StripeModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService, CartRepository],
})
export class CartModule {}
