import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/pbkdf2-password";
import { recordBusinessEvent } from "@/lib/business-portal";
import type { BusinessAccount } from "@prisma/client";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

export function isValidBusinessPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

/**
 * Sets (or replaces) the password for an already-authenticated business
 * account. Fedor remains the only one who creates/approves accounts; this
 * only adds a second login method to an existing session, it never creates
 * a new account.
 */
export async function setBusinessAccountPassword(businessAccountId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const account = await tx.businessAccount.update({
      where: { id: businessAccountId },
      data: { passwordHash },
    });
    await recordBusinessEvent(tx, {
      businessAccountId,
      type: "PASSWORD_SET",
      actorType: "CUSTOMER",
      actorName: account.contactName,
      summary: `${account.contactName} heeft een wachtwoord ingesteld voor de zakelijke omgeving`,
    });
  });
}

/**
 * Verifies email+password against an APPROVED business account. Returns
 * null on any mismatch (unknown email, no password set yet, wrong
 * password, unapproved/suspended account) without distinguishing which —
 * the caller should show one generic "invalid credentials" message.
 */
export async function verifyBusinessPasswordLogin(emailCandidate: string, password: string): Promise<BusinessAccount | null> {
  const email = emailCandidate.trim().toLowerCase();
  if (!email || email.length > 320) return null;

  const account = await prisma.businessAccount.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "APPROVED" },
  });
  if (!account?.passwordHash) return null;

  const valid = await verifyPassword(password, account.passwordHash);
  return valid ? account : null;
}
