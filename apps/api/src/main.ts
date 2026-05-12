import "./fastify-augment";
import { initSentry } from "./sentry";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify/types/instance";
import * as Sentry from "@sentry/node";
import type { FastifyRequest } from "fastify/types/request";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import csrf from "@fastify/csrf-protection";
import { Logger } from "nestjs-pino";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap() {
  // Must run before NestFactory.create so the SDK instruments require() hooks.
  initSentry();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // Wire Sentry's Fastify error handler so unhandled route errors are captured.
  // Must be called after the Fastify instance exists but before routes are set.
  // The intermediate cast to unknown is necessary because NestJS exposes the
  // adapter instance typed as the Fastify base type while Sentry expects a
  // more specific generic parameterisation.
  Sentry.setupFastifyErrorHandler(app.getHttpAdapter().getInstance() as unknown as FastifyInstance);

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
      env.STOREFRONT_URL ?? "http://localhost:3000",
      env.ADMIN_URL ?? "http://localhost:3001",
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
  await app.register(csrf, {
    cookieKey: "csrf-token",
    cookieOpts: {
      httpOnly: false, // front-end must read for the double-submit header
      secure: env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    },
    csrfOpts: {
      // hmacKey ties each token to a session secret, strengthening the double-submit
      hmacKey: env.CSRF_SECRET,
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

  if (env.NODE_ENV !== "production") {
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

  await app.listen(env.PORT, "0.0.0.0");
}

void bootstrap();
