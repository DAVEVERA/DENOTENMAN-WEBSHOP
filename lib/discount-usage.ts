import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeDiscountCode, type DiscountUsagePolicy } from "@/lib/discounts";

type IdentityInput = {
  email: string;
  userId: string | null;
};

export class DiscountUsageLimitError extends Error {
  constructor() {
    super("Discount code usage limit reached");
    this.name = "DiscountUsageLimitError";
  }
}

function normalizedEmail(email: string): string {
  return email.trim().toLocaleLowerCase("nl-NL");
}

export function discountIdentityKey(
  scope: DiscountUsagePolicy["identityScope"],
  identity: IdentityInput
): string {
  const email = normalizedEmail(identity.email);
  const source = scope === "CUSTOMER"
    ? `customer:${identity.userId ?? email}`
    : scope === "EMAIL_AND_CUSTOMER"
      ? `email-customer:${email}:${identity.userId ?? email}`
      : `email:${email}`;
  return createHash("sha256").update(source).digest("hex");
}

function historicalIdentityWhere(
  scope: DiscountUsagePolicy["identityScope"],
  identity: IdentityInput
): Prisma.OrderWhereInput {
  const emailWhere = { contactEmail: { equals: normalizedEmail(identity.email), mode: "insensitive" as const } };
  if (scope === "CUSTOMER" && identity.userId) return { userId: identity.userId };
  if (scope === "EMAIL_AND_CUSTOMER" && identity.userId) {
    return { AND: [{ userId: identity.userId }, emailWhere] };
  }
  return emailWhere;
}

async function historicalUseCount(
  tx: Prisma.TransactionClient,
  policy: DiscountUsagePolicy,
  identity: IdentityInput
): Promise<number> {
  return tx.order.count({
    where: {
      isTest: false,
      status: { in: ["PAID", "FULFILLED", "REFUNDED"] },
      discountCode: { equals: policy.code, mode: "insensitive" },
      ...historicalIdentityWhere(policy.identityScope, identity),
      discountRedemption: null,
    },
  });
}

export async function discountUsageAvailable(
  policy: DiscountUsagePolicy,
  identity: IdentityInput
): Promise<boolean> {
  if (policy.maxUsesPerIdentity === null) return true;
  const identityKey = discountIdentityKey(policy.identityScope, identity);
  const counter = await prisma.discountUsageCounter.findUnique({
    where: { code_identityKey: { code: normalizeDiscountCode(policy.code), identityKey } },
    select: { usageCount: true },
  });
  if (counter) return counter.usageCount < policy.maxUsesPerIdentity;
  const legacyCount = await historicalUseCount(prisma, policy, identity);
  return legacyCount < policy.maxUsesPerIdentity;
}

export async function reserveDiscountUsage(
  tx: Prisma.TransactionClient,
  policy: DiscountUsagePolicy,
  identity: IdentityInput,
  orderId: string
): Promise<void> {
  const code = normalizeDiscountCode(policy.code);
  const identityKey = discountIdentityKey(policy.identityScope, identity);
  const existingCounter = await tx.discountUsageCounter.findUnique({
    where: { code_identityKey: { code, identityKey } },
  });
  const legacyCount = existingCounter ? 0 : await historicalUseCount(tx, policy, identity);
  if (!existingCounter && policy.maxUsesPerIdentity !== null && legacyCount >= policy.maxUsesPerIdentity) {
    throw new DiscountUsageLimitError();
  }
  const counter = existingCounter ?? await tx.discountUsageCounter.upsert({
    where: { code_identityKey: { code, identityKey } },
    create: { code, identityKey, usageCount: legacyCount },
    update: {},
  });
  const claimed = await tx.discountUsageCounter.updateMany({
    where: {
      id: counter.id,
      ...(policy.maxUsesPerIdentity === null
        ? {}
        : { usageCount: { lt: policy.maxUsesPerIdentity } }),
    },
    data: { usageCount: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new DiscountUsageLimitError();

  await tx.discountRedemption.create({
    data: { counterId: counter.id, orderId, status: "RESERVED" },
  });
}

export async function settleDiscountRedemption(
  tx: Prisma.TransactionClient,
  orderId: string,
  nextStatus: "REDEEMED" | "RELEASED"
): Promise<void> {
  const redemption = await tx.discountRedemption.findUnique({
    where: { orderId },
    select: { id: true, counterId: true, status: true },
  });
  if (!redemption || redemption.status !== "RESERVED") return;

  const settled = await tx.discountRedemption.updateMany({
    where: { id: redemption.id, status: "RESERVED" },
    data: { status: nextStatus },
  });
  if (settled.count === 1 && nextStatus === "RELEASED") {
    await tx.discountUsageCounter.updateMany({
      where: { id: redemption.counterId, usageCount: { gt: 0 } },
      data: { usageCount: { decrement: 1 } },
    });
  }
}
