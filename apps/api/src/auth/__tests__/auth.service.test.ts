import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { PinoLogger } from "nestjs-pino";
import { AuthService } from "../auth.service";
import type { ArgonHasher } from "../argon-hasher";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import type { PrismaService } from "../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(
  overrides: Partial<{
    id: string;
    email: string;
    passwordHash: string;
    role: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }> = {},
) {
  return {
    id: "user-uuid-1",
    email: "user@example.com",
    passwordHash: "hashed",
    role: "customer",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    ...overrides,
  };
}

function makeRefreshToken(
  overrides: Partial<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
  }> = {},
) {
  return {
    id: "rt-uuid-1",
    userId: "user-uuid-1",
    tokenHash: "abc123",
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    createdAt: new Date(),
    userAgent: null,
    ipAddress: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factories — store vi.fn() refs so assertions don't trigger unbound-method
// ---------------------------------------------------------------------------

interface RepoMocks {
  repo: RefreshTokenRepository;
  create: ReturnType<typeof vi.fn>;
  findByHash: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  revokeAllForUser: ReturnType<typeof vi.fn>;
}

function makeRepo(): RepoMocks {
  const create = vi.fn().mockResolvedValue(makeRefreshToken());
  const findByHash = vi.fn().mockResolvedValue(null);
  const rotate = vi.fn().mockResolvedValue(makeRefreshToken());
  const revoke = vi.fn().mockResolvedValue(undefined);
  const revokeAllForUser = vi.fn().mockResolvedValue(undefined);
  const repo = {
    create,
    findByHash,
    rotate,
    revoke,
    revokeAllForUser,
  } as unknown as RefreshTokenRepository;
  return { repo, create, findByHash, rotate, revoke, revokeAllForUser };
}

interface ArgonMocks {
  argon: ArgonHasher;
  verify: ReturnType<typeof vi.fn>;
}

function makeArgon(valid: boolean): ArgonMocks {
  const verify = vi.fn().mockResolvedValue(valid);
  const hash = vi.fn().mockResolvedValue("$argon2id$dummy");
  const argon = { hash, verify } as unknown as ArgonHasher;
  return { argon, verify };
}

function makeJwt(): JwtService {
  return {
    signAsync: vi.fn().mockResolvedValue("signed.access.token"),
  } as unknown as JwtService;
}

interface LoggerMocks {
  logger: PinoLogger;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function makeLogger(): LoggerMocks {
  const warn = vi.fn();
  const error = vi.fn();
  const logger = { warn, error, info: vi.fn() } as unknown as PinoLogger;
  return { logger, warn, error };
}

interface PrismaMocks {
  prisma: PrismaService;
  auditCreate: ReturnType<typeof vi.fn>;
}

function makePrisma(user: ReturnType<typeof makeUser> | null = makeUser()): PrismaMocks {
  const auditCreate = vi.fn().mockResolvedValue({});
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
    auditLog: { create: auditCreate },
  } as unknown as PrismaService;
  return { prisma, auditCreate };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuthService.login", () => {
  const UA = "test-agent";
  const IP = "127.0.0.1";

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path — correct credentials → returns user + tokens", async () => {
    const { argon } = makeArgon(true);
    const jwt = makeJwt();
    const { repo, create } = makeRepo();
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const svc = new AuthService(jwt, argon, repo, prisma, logger);

    const result = await svc.login({ email: "user@example.com", password: "correct" }, UA, IP);

    expect(result.accessToken).toBe("signed.access.token");
    expect(result.user.email).toBe("user@example.com");
    expect(create).toHaveBeenCalledOnce();
  });

  it("wrong password — throws 401", async () => {
    const { argon } = makeArgon(false);
    const { repo } = makeRepo();
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);

    await expect(
      svc.login({ email: "user@example.com", password: "wrong" }, UA, IP),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("unknown user — throws 401 and still calls verify (always-hash guard)", async () => {
    const { argon, verify } = makeArgon(false);
    const { prisma } = makePrisma(null);
    const { repo } = makeRepo();
    const { logger } = makeLogger();
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);

    await expect(
      svc.login({ email: "ghost@example.com", password: "any" }, UA, IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(verify).toHaveBeenCalledOnce();
  });

  it("unknown user and wrong password produce identical error codes", async () => {
    const { prisma: prismaWithUser } = makePrisma();
    const { prisma: prismaNoUser } = makePrisma(null);
    const { argon: a1 } = makeArgon(false);
    const { argon: a2 } = makeArgon(false);
    const { repo: r1 } = makeRepo();
    const { repo: r2 } = makeRepo();
    const { logger: l1 } = makeLogger();
    const { logger: l2 } = makeLogger();
    const svcWrong = new AuthService(makeJwt(), a1, r1, prismaWithUser, l1);
    const svcUnknown = new AuthService(makeJwt(), a2, r2, prismaNoUser, l2);

    let errWrong: UnauthorizedException | undefined;
    let errUnknown: UnauthorizedException | undefined;
    try {
      await svcWrong.login({ email: "user@example.com", password: "bad" }, UA, IP);
    } catch (e) {
      errWrong = e as UnauthorizedException;
    }
    try {
      await svcUnknown.login({ email: "ghost@example.com", password: "bad" }, UA, IP);
    } catch (e) {
      errUnknown = e as UnauthorizedException;
    }

    expect(errWrong?.getStatus()).toBe(401);
    expect(errUnknown?.getStatus()).toBe(401);

    const wrongBody = errWrong?.getResponse() as { error: { code: string } };
    const unknownBody = errUnknown?.getResponse() as { error: { code: string } };
    expect(wrongBody.error.code).toBe(unknownBody.error.code);
  });
});

describe("AuthService.refresh", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path — valid token → new access token, old token rotated", async () => {
    const { repo, findByHash, rotate } = makeRepo();
    findByHash.mockResolvedValue(makeRefreshToken());
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const { argon } = makeArgon(true);

    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);
    vi.spyOn(svc, "hashToken").mockReturnValue("abc123");

    const result = await svc.refresh("raw-token-64-hex-chars-aaaaaaaaaa", "ua", "1.2.3.4");

    expect(result.accessToken).toBe("signed.access.token");
    expect(rotate).toHaveBeenCalledOnce();
  });

  it("already-revoked token → 401 + cascade-revoke all user tokens", async () => {
    const { repo, findByHash, revokeAllForUser } = makeRepo();
    findByHash.mockResolvedValue(makeRefreshToken({ revokedAt: new Date() }));
    const { prisma, auditCreate } = makePrisma();
    const { logger, warn } = makeLogger();
    const { argon } = makeArgon(true);

    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);
    vi.spyOn(svc, "hashToken").mockReturnValue("abc123");

    await expect(svc.refresh("raw-token", "ua", "1.2.3.4")).rejects.toThrow(UnauthorizedException);

    expect(revokeAllForUser).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("token not found → 401", async () => {
    const { repo, findByHash } = makeRepo();
    findByHash.mockResolvedValue(null);
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const { argon } = makeArgon(true);
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);

    await expect(svc.refresh("unknown-raw", "ua", "1.2.3.4")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("expired token → 401", async () => {
    const { repo, findByHash } = makeRepo();
    findByHash.mockResolvedValue(makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }));
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const { argon } = makeArgon(true);
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);
    vi.spyOn(svc, "hashToken").mockReturnValue("abc123");

    await expect(svc.refresh("raw", "ua", "1.2.3.4")).rejects.toThrow(UnauthorizedException);
  });
});

describe("AuthService.logout", () => {
  it("revokes token when found and not already revoked", async () => {
    const { repo, findByHash, revoke } = makeRepo();
    findByHash.mockResolvedValue(makeRefreshToken());
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const { argon } = makeArgon(true);
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);

    await svc.logout("raw-token");

    expect(revoke).toHaveBeenCalledOnce();
  });

  it("does nothing when token not found", async () => {
    const { repo, findByHash, revoke } = makeRepo();
    findByHash.mockResolvedValue(null);
    const { prisma } = makePrisma();
    const { logger } = makeLogger();
    const { argon } = makeArgon(true);
    const svc = new AuthService(makeJwt(), argon, repo, prisma, logger);

    await svc.logout("not-found");

    expect(revoke).not.toHaveBeenCalled();
  });
});
