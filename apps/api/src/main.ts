import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import csrf from "@fastify/csrf-protection";
import { Logger } from "nestjs-pino";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { assertEnv } from "./auth/env";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  await app.register(helmet);
  await app.register(cors, {
    origin: [
      process.env.STOREFRONT_URL ?? "http://localhost:3000",
      process.env.ADMIN_URL ?? "http://localhost:3001",
    ],
    credentials: true,
  });
  await app.register(cookie);

  // CSRF protection (ADR 0009) — double-submit cookie pattern with @fastify/cookie.
  //
  // Cookie attributes (ADR 0009):
  //   csrf-token cookie (cookieKey):  HttpOnly=false — front-end reads it for the double-submit.
  //   The secret is stored in a separate _csrf cookie set HttpOnly by the plugin by default.
  //
  // Exemption is handled by CsrfGuard (a NestJS APP_GUARD) which:
  //   1. Skips routes decorated @PublicApi() — Bearer-only, no CSRF surface.
  //   2. Skips CSRF_EXEMPT_ROUTES (hard list in auth.constants) — /v1/stripe/webhook
  //      is pre-listed so PR-C (Stripe module) works without touching this file.
  //   3. Calls fastify.csrfProtection() for all other POST/PUT/PATCH/DELETE routes.
  //
  // The CSRF_SECRET env variable is validated here; EnvService (#5 PR-A) will own this later.
  const csrfSecret = assertEnv("CSRF_SECRET");
  await app.register(csrf, {
    cookieKey: "csrf-token",
    cookieOpts: {
      httpOnly: false, // front-end must read for the double-submit header
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    },
    csrfOpts: {
      // hmacKey ties each token to a session secret, strengthening the double-submit
      hmacKey: csrfSecret,
    },
    getToken: (req) => {
      const headers = req.headers as Record<string, string | string[] | undefined>;
      const val = headers["x-csrf-token"];
      return Array.isArray(val) ? (val[0] ?? "") : (val ?? "");
    },
  });

  app.setGlobalPrefix("v1", {
    exclude: ["healthz", "readyz", "docs"],
  });

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("DeNotenman API")
      .setDescription("Webshop REST API")
      .setVersion("1.0")
      .addBearerAuth()
      .addCookieAuth("refresh_token")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  const port = parseInt(process.env.PORT ?? "4000", 10);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
