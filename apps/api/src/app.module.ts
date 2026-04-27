import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ProductsModule } from "./products/products.module";
import { CategoriesModule } from "./categories/categories.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
