import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiCookieAuth, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { IncomingHttpHeaders } from "http";
import { AuthService } from "./auth.service";
import { PublicApi } from "./decorators/public-api.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { AuthenticatedUser } from "./decorators/current-user.decorator";
import { LoginSchema } from "./dto/login.dto";
import { COOKIE_REFRESH_TOKEN, REFRESH_TOKEN_TTL_SECONDS } from "./auth.constants";

// The v4 typedef declares generateCsrf(): FastifyReply but the runtime
// implementation is an async function that resolves to the token string.
// Cast via unknown to avoid the return-type conflict.
interface CsrfReply {
  generateCsrf: () => Promise<string>;
}

function extractUserAgent(headers: IncomingHttpHeaders): string | null {
  const ua = headers["user-agent"];
  return ua ?? null;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ---------------------------------------------------------------------------
  // POST /v1/auth/login
  // ---------------------------------------------------------------------------

  @Post("login")
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Inloggen en token-paar ontvangen" })
  async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ongeldige invoer",
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await this.auth.login(parsed.data, extractUserAgent(req.headers), req.ip);

    this.setRefreshCookie(res, result.refreshToken);

    return { user: result.user, accessToken: result.accessToken };
  }

  // ---------------------------------------------------------------------------
  // POST /v1/auth/refresh
  // ---------------------------------------------------------------------------

  @Post("refresh")
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Access-token vernieuwen via refresh-cookie" })
  @ApiCookieAuth(COOKIE_REFRESH_TOKEN)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const cookies = req.cookies;
    const rawToken = cookies[COOKIE_REFRESH_TOKEN];
    if (!rawToken) {
      throw new UnauthorizedException({
        error: { code: "MISSING_TOKEN", message: "Refresh-token ontbreekt" },
      });
    }

    const result = await this.auth.refresh(rawToken, extractUserAgent(req.headers), req.ip);

    this.setRefreshCookie(res, result.refreshToken);

    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  // ---------------------------------------------------------------------------
  // POST /v1/auth/logout
  // ---------------------------------------------------------------------------

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Uitloggen — refresh-token intrekken" })
  @ApiBearerAuth()
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const cookies = req.cookies;
    const rawToken = cookies[COOKIE_REFRESH_TOKEN];
    if (rawToken) {
      await this.auth.logout(rawToken);
    }
    res.clearCookie(COOKIE_REFRESH_TOKEN, { path: "/v1/auth/refresh" });
    return;
  }

  // ---------------------------------------------------------------------------
  // GET /v1/auth/me
  // ---------------------------------------------------------------------------

  @Get("me")
  @ApiOperation({ summary: "Huidig ingelogde gebruiker ophalen" })
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }

  // ---------------------------------------------------------------------------
  // GET /v1/auth/csrf  — issues a fresh CSRF token pair to the client
  // ---------------------------------------------------------------------------

  @Get("csrf")
  @PublicApi()
  @ApiOperation({ summary: "CSRF-token ophalen (double-submit cookie)" })
  async csrf(@Res({ passthrough: true }) res: FastifyReply) {
    const replyWithCsrf = res as unknown as CsrfReply;
    if (typeof replyWithCsrf.generateCsrf !== "function") {
      throw new UnauthorizedException({
        error: { code: "CSRF_UNAVAILABLE", message: "CSRF-bescherming niet beschikbaar" },
      });
    }
    // generateCsrf sets the csrf-token cookie and returns the token string.
    const token = await replyWithCsrf.generateCsrf();
    return { csrfToken: token };
  }

  // ---------------------------------------------------------------------------
  // Cookie helper
  // ---------------------------------------------------------------------------

  private setRefreshCookie(res: FastifyReply, rawToken: string): void {
    res.setCookie(COOKIE_REFRESH_TOKEN, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/v1/auth/refresh",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });
  }
}
