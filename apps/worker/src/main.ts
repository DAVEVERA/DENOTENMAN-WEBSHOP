import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  // trustProxy: true ensures accurate client IP behind a reverse proxy / load balancer.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  const port = parseInt(process.env.WORKER_PORT ?? "3002", 10);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
