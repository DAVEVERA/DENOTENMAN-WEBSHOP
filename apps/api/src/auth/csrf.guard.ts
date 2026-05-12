import { Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest, FastifyReply } from "fastify";
import { IS_PUBLIC_KEY, CSRF_EXEMPT_ROUTES } from "./auth.constants";

// Methods that mutate state and require CSRF verification.
const PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface ServerWithCsrf {
  csrfProtection: (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => void;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // @PublicApi() routes use Bearer-only auth — no CSRF surface (ADR 0009).
    if (isPublic) {
      return Promise.resolve(true);
    }

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();

    if (!PROTECTED_METHODS.has(req.method.toUpperCase())) {
      return Promise.resolve(true);
    }

    // Hard-coded exempt list per ADR 0009 — auditor reviews all diffs here.
    // /v1/stripe/webhook is exempt because its auth is an HMAC signature.
    for (const exempt of CSRF_EXEMPT_ROUTES) {
      if (req.url === exempt || req.url.startsWith(`${exempt}?`)) {
        return Promise.resolve(true);
      }
    }

    const reply = ctx.switchToHttp().getResponse<FastifyReply>();
    const server = (req as FastifyRequest & { server: ServerWithCsrf }).server;

    return new Promise<boolean>((resolve, reject) => {
      server.csrfProtection(req, reply, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
}
