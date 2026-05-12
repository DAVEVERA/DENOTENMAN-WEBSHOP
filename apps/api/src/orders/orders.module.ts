import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderStateService } from "./order-state.service";
import { OrderRepository } from "./repositories/order.repository";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateService, OrderRepository],
  exports: [OrdersService, OrderStateService, OrderRepository],
})
export class OrdersModule {}
