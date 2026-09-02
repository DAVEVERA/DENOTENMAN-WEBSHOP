import { createHash } from "node:crypto";

export const BUSINESS_SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-denotenman_business"
  : "denotenman_business_session";
export const BUSINESS_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const POSTGRES_INT_MAX = 2_147_483_647;

export function hashBusinessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function businessSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: BUSINESS_SESSION_TTL_SECONDS,
    expires: expiresAt,
    priority: "high" as const,
  };
}

/**
 * A quantity of 0 is valid and contributes nothing to the total: on a
 * continuous order list it means "on the list, not ordered this round" —
 * either because the customer hasn't chosen an amount yet, or because a
 * completed checkout reset it for the next round.
 */
export function calculateBusinessOrderListTotal(
  items: ReadonlyArray<{ quantity: number; unitPriceCents: number }>
): number {
  let total = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0) throw new Error("INVALID_QUANTITY");
    if (!Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0) throw new Error("INVALID_UNIT_PRICE");
    const lineTotal = item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(lineTotal) || lineTotal > POSTGRES_INT_MAX - total) throw new Error("TOTAL_OUT_OF_RANGE");
    total += lineTotal;
  }
  return total;
}

export function businessOrderListIsExpired(
  validUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!validUntil) return false;
  return new Date(validUntil).getTime() <= now.getTime();
}
