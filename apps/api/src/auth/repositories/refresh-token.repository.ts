import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RefreshToken } from "@denotenman/prisma";

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, userAgent, ipAddress },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Atomic rotate: revoke the old token and insert a new one in a single
   * transaction, preventing torn state (ADR 0007).
   */
  async rotate(
    oldHash: string,
    newHash: string,
    expiresAt: Date,
    userAgent: string | null,
    ipAddress: string | null,
    userId: string,
  ): Promise<RefreshToken> {
    const [, next] = await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { tokenHash: oldHash },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: { userId, tokenHash: newHash, expiresAt, userAgent, ipAddress },
      }),
    ]);
    return next;
  }

  /**
   * Cascade-revoke all refresh tokens for a user on breach detection (ADR 0007).
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }
}
