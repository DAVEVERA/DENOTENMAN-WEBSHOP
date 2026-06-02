import { Injectable, ForbiddenException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./auth.constants";
import type { AuthenticatedUser } from "./decorators/current-user.decorator";
import type { UserRole } from "@denotenman/schemas";
import type { FastifyRequest } from "fastify";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Roles() decorator → route does not require a specific role.
    if (!required || required.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({ error: { code: "FORBIDDEN", message: "Niet geautoriseerd" } });
    }

    if (!required.includes(user.role as UserRole)) {
      throw new ForbiddenException({ error: { code: "FORBIDDEN", message: "Niet geautoriseerd" } });
    }

    return true;
  }
}
