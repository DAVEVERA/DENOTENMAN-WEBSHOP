import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { env } from "../env";
import type { AuthenticatedUser } from "./decorators/current-user.decorator";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iss: string;
  aud: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Per ADR 0007: explicit algorithm list — rejects alg=none and RS*/ES* confusion attacks.
      algorithms: ["HS256"],
      secretOrKey: env.JWT_ACCESS_SECRET,
      issuer: "denotenman-api",
      audience: "denotenman-client",
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException("Token payload invalide");
    }
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
