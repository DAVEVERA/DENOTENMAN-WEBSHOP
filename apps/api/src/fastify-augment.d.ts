/**
 * Module augmentation — adds `rawBody` to both the Fastify request wrapper
 * and the underlying Node.js IncomingMessage so that the Stripe webhook
 * route can attach the original bytes for HMAC signature verification.
 *
 * addContentTypeParser in main.ts sets req.rawBody on the IncomingMessage
 * when the route URL begins with /v1/stripe/webhook. The RawBody param
 * decorator reads it back via the FastifyRequest.raw property.
 */
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}
