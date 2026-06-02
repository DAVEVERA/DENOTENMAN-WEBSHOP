import { initSentry } from "./sentry";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import * as Sentry from "@sentry/node";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap() {
  // Must run before NestFactory.create so the SDK instruments require() hooks.
  initSentry();

  // trustProxy: true ensures accurate client IP behind a reverse proxy / load balancer.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // Wire Sentry's Fastify error handler for the health-check HTTP layer.
  // Intermediate cast to unknown: NestJS exposes the adapter instance typed as
  // the Fastify base type while Sentry expects a more specific generic parameterisation.
  Sentry.setupFastifyErrorHandler(app.getHttpAdapter().getInstance());

  await app.listen(env.WORKER_PORT, "0.0.0.0");
}

void bootstrap();
