import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

/**
 * Extracts the raw request body buffer attached to `req.raw.rawBody`
 * for the /v1/stripe/webhook route.
 *
 * The buffer is set in main.ts via addContentTypeParser on the Node.js
 * IncomingMessage (req.raw) so that Stripe's signature verification has
 * access to the original, unparsed bytes.
 *
 * Fastify augmentation is in src/fastify-augment.d.ts.
 */
export const RawBody = createParamDecorator((_data: unknown, ctx: ExecutionContext): Buffer => {
  const req = ctx.switchToHttp().getRequest<{ raw: IncomingMessage }>();
  const rawBody = req.raw.rawBody;

  if (!Buffer.isBuffer(rawBody)) {
    throw new Error(
      "rawBody is not a Buffer — ensure addContentTypeParser is configured for this route",
    );
  }

  return rawBody;
});
