import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import crypto from "crypto";
import { ArgonHasher } from "./argon-hasher";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  AUDIT_REFRESH_REUSE,
} from "./auth.constants";
import { env } from "../env";
import type { LoginDto } from "./dto/login.dto";
import type { AuthenticatedUser } from "./decorators/current-user.decorator";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    role: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  };
  accessToken: string;
  refreshToken: string;
}

// Stable dummy hash used for the always-hash path (constant-time user enumeration guard).
// Computed once at module load — not a secret, purely for timing parity.
let DUMMY_HASH: string | null = null;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly argon: ArgonHasher,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly prisma: PrismaService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    dto: LoginDto,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      // Always-hash guard: run a verify against a dummy hash so timing is
      // indistinguishable from a wrong-password attempt on a real account.
      await this.argon.verify(await this.getDummyHash(), dto.password);
      this.throwInvalidCredentials();
    }

    const valid = await this.argon.verify(user.passwordHash, dto.password);
    if (!valid) {
      this.throwInvalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokenPair(
      user.id,
      user.email,
      user.role,
      userAgent,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---------------------------------------------------------------------------
  // Refresh — sliding rotation with breach detection (ADR 0007)
  // ---------------------------------------------------------------------------

  async refresh(
    rawToken: string,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<TokenPair> {
    const presentedHash = this.hashToken(rawToken);
    const stored = await this.refreshTokens.findByHash(presentedHash);

    if (!stored) {
      throw new UnauthorizedException({
        error: { code: "INVALID_TOKEN", message: "Ongeldig refresh-token" },
      });
    }

    if (stored.revokedAt !== null) {
      // Breach signal: revoke entire session and log the event (ADR 0007).
      await this.refreshTokens.revokeAllForUser(stored.userId);
      await this.appendAuditEvent(stored.userId, ipAddress, userAgent);
      this.logger.warn(
        { userId: stored.userId, ipAddress },
        "refresh token reuse detected — all tokens revoked",
      );
      throw new UnauthorizedException({
        error: { code: "TOKEN_REUSE", message: "Verdacht token-hergebruik gedetecteerd" },
      });
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        error: { code: "TOKEN_EXPIRED", message: "Refresh-token verlopen" },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException({
        error: { code: "USER_NOT_FOUND", message: "Gebruiker niet gevonden" },
      });
    }

    const newRawToken = this.generateRawToken();
    const newHash = this.hashToken(newRawToken);
    const expiresAt = this.refreshExpiresAt();

    await this.refreshTokens.rotate(
      presentedHash,
      newHash,
      expiresAt,
      userAgent,
      ipAddress,
      user.id,
    );

    const accessToken = await this.signAccessToken(user.id, user.email, user.role);

    return {
      accessToken,
      refreshToken: newRawToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async logout(rawToken: string): Promise<void> {
    const hash = this.hashToken(rawToken);
    const stored = await this.refreshTokens.findByHash(hash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(hash);
    }
  }

  // ---------------------------------------------------------------------------
  // Me — resolve authenticated user from JWT payload
  // ---------------------------------------------------------------------------

  async me(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        error: { code: "USER_NOT_FOUND", message: "Gebruiker niet gevonden" },
      });
    }

    return user;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async issueTokenPair(
    userId: string,
    email: string,
    role: string,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.signAccessToken(userId, email, role);
    const rawRefresh = this.generateRawToken();
    const tokenHash = this.hashToken(rawRefresh);
    const expiresAt = this.refreshExpiresAt();

    await this.refreshTokens.create(userId, tokenHash, expiresAt, userAgent, ipAddress);

    return { accessToken, refreshToken: rawRefresh };
  }

  private signAccessToken(userId: string, email: string, role: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: "HS256",
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: "denotenman-api",
        audience: "denotenman-client",
      },
    );
  }

  /** sha256 hex — per ADR 0007: token has 256 bits of entropy, no per-row salt needed. */
  hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  private generateRawToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private refreshExpiresAt(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      error: { code: "INVALID_CREDENTIALS", message: "Ongeldig e-mailadres of wachtwoord" },
    });
  }

  private async getDummyHash(): Promise<string> {
    // Lazily compute a valid hash once — used only for timing parity on unknown users.
    DUMMY_HASH ??= await this.argon.hash("__dummy__constant__timing__placeholder__");
    return DUMMY_HASH;
  }

  private async appendAuditEvent(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: "update",
          entityType: "RefreshToken",
          entityId: userId,
          metadata: { event: AUDIT_REFRESH_REUSE },
          ipAddress,
          userAgent,
        },
      });
    } catch (err: unknown) {
      // Non-fatal: log the audit failure but do not prevent the 401 response.
      this.logger.error({ err, userId }, "Failed to write audit log for reuse detection");
    }
  }
}
