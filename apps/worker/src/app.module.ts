import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import type { IncomingMessage } from "node:http";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        autoLogging: true,
        genReqId: (req: IncomingMessage) =>
          (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID(),
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
