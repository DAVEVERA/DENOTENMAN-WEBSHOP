import "./fastify-augment";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify/types/instance";
import type { FastifyRequest } from "fastify/types/request";
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

  // Raw body parser for the Stripe webhook route (ADR 0008).
  //
  // All requests arriving as application/json are intercepted here. Requests
  // targeting /v1/stripe/webhook need the original raw bytes so that Stripe's
  // HMAC signature can be verified. Every other route gets the standard
  // JSON-parsed body.
  //
  // FastifyRequest.rawBody is typed via src/fastify-augment.d.ts — zero `any`.
  // addContentTypeParser is called via the NestJS Fastify adapter's register
  // pass-through to avoid needing a direct FastifyInstance cast.
  await app.register((instance: FastifyInstance, _opts: unknown, done: () => void) => {
    instance.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (req, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
        // req.raw is IncomingMessage (Node.js http) — url is always present at runtime.
        if (req.raw.url?.startsWith("/v1/stripe/webhook")) {
          req.raw.rawBody = body;
          done(null, body);
          return;
        }
        try {
          done(null, JSON.parse(body.toString("utf8")));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
    done();
  });

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
    getToken: (req: FastifyRequest) => {
      // headers is typed via IncomingHttpHeaders which allows bracket access for custom headers.
      const rawVal: string | string[] | undefined = (
        req.headers as Record<string, string | string[] | undefined>
      )["x-csrf-token"];
      return Array.isArray(rawVal) ? (rawVal[0] ?? "") : (rawVal ?? "");
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
