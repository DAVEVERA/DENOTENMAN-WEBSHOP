import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
import { CategoriesModule } from "./categories/categories.module";
import { AuthModule } from "./auth/auth.module";
import { StripeModule } from "./stripe/stripe.module";
import { CartModule } from "./cart/cart.module";
import { OrdersModule } from "./orders/orders.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { CsrfGuard } from "./auth/csrf.guard";
import { env } from "./env";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        autoLogging: true,
        genReqId: (req) =>
          (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID(),
      },
    }),
    ThrottlerModule.forRoot([
      { name: "public", ttl: 60_000, limit: 100 },
      { name: "auth", ttl: 60_000, limit: 30 },
    ]),
    PrismaModule,
    HealthModule,
    ProductsModule,
    CategoriesModule,
    AuthModule,
    StripeModule,
    CartModule,
    OrdersModule,
  ],
  providers: [
    // Rate limiting — applied first.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // JWT authentication — routes decorated @PublicApi() are exempt.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // RBAC — only active when @Roles(...) is present on the handler or class.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // CSRF — POST/PUT/PATCH/DELETE routes with cookie auth. @PublicApi() and
    // hard-coded exempt routes (Stripe webhook) bypass verification.
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
