import { describe, it, expect, vi } from "vitest";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import type { PrismaService } from "../../prisma/prisma.service";

function makeToken(overrides = {}) {
  return {
    id: "rt-1",
    userId: "user-1",
    tokenHash: "new-hash",
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    createdAt: new Date(),
    userAgent: null,
    ipAddress: null,
    ...overrides,
  };
}

describe("RefreshTokenRepository.rotate", () => {
  it("runs revoke + insert in a single $transaction (no torn state)", async () => {
    const transactionFn = vi
      .fn()
      .mockResolvedValue([
        { ...makeToken(), revokedAt: new Date() },
        makeToken({ tokenHash: "new-hash" }),
      ]);

    const prisma = {
      refreshToken: {
        update: vi.fn().mockReturnValue("update-op"),
        create: vi.fn().mockReturnValue("create-op"),
      },
      $transaction: transactionFn,
    } as unknown as PrismaService;

    const repo = new RefreshTokenRepository(prisma);
    const expiresAt = new Date(Date.now() + 86400_000);

    const result = await repo.rotate("old-hash", "new-hash", expiresAt, "ua", "ip", "user-1");

    // Transaction called with an array of operations (not a callback) — no torn state.
    expect(transactionFn).toHaveBeenCalledOnce();
    const firstCall: unknown = transactionFn.mock.calls[0];
    const [ops] = firstCall as [unknown[]];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);

    expect(result.tokenHash).toBe("new-hash");
  });

  it("revokeAllForUser calls updateMany with correct filter", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      refreshToken: { updateMany },
    } as unknown as PrismaService;

    const repo = new RefreshTokenRepository(prisma);
    await repo.revokeAllForUser("user-1");

    const anyDate: unknown = expect.any(Date);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: anyDate },
    });
  });
});
