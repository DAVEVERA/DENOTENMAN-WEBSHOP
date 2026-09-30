import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { verifyPassword } from "@/lib/pbkdf2-password";

// The developer portal sits inside the admin area and adds its own login on top of
// the admin session. Only the developer knows these credentials; the password is
// configured as a PBKDF2 hash (DEVELOPER_PORTAL_PASSWORD_HASH), never as plain text.

export const DEVELOPER_SESSION_COOKIE = "denotenman_developer_session";
export const DEVELOPER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; firstAt: number }>();

/**
 * The configured hash. Next's .env loader expands "$…" in values, which breaks the usual
 * pbkdf2$iterations$salt$key notation, so the hash may also use colons:
 * pbkdf2:iterations:salt:key (all parts are digits or hex, so both read the same).
 */
function configuredPasswordHash(): string | null {
  const value = process.env.DEVELOPER_PORTAL_PASSWORD_HASH?.trim();
  if (!value) return null;
  return value.startsWith("pbkdf2:") ? value.split(":").join("$") : value;
}

export function developerPortalConfigured(): boolean {
  return Boolean(configuredPasswordHash() && process.env.ADMIN_SESSION_SECRET);
}

function expectedUsername(): string {
  return process.env.DEVELOPER_PORTAL_USERNAME?.trim() || "MNRV";
}

function signingKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  // A key of its own, derived from the admin secret, so an admin session token can
  // never be replayed as a developer session and the other way round.
  return createHmac("sha256", secret).update("developer-portal-session-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A developer session is bound to the admin account that was logged in when it started. */
export function createDeveloperSessionToken(adminUserId: string, now = Date.now()): string {
  const payload = `developer.${adminUserId}.${now + DEVELOPER_SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyDeveloperSessionToken(
  token: string | null | undefined,
  adminUserId: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "developer") return false;
  const [, tokenAdminId, expires, signature] = parts;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || now > expiresAt || tokenAdminId !== adminUserId) return false;
  try {
    return safeEqual(sign(`developer.${tokenAdminId}.${expires}`), signature);
  } catch {
    return false;
  }
}

export type DeveloperLoginResult = "OK" | "INVALID" | "LOCKED" | "NOT_CONFIGURED";

/** Checks the developer credentials; five failures from one address lock it for 15 minutes. */
export async function verifyDeveloperCredentials(
  username: string,
  password: string,
  clientKey: string,
  now = Date.now(),
): Promise<DeveloperLoginResult> {
  const hash = configuredPasswordHash();
  if (!hash) return "NOT_CONFIGURED";

  const attempts = failedAttempts.get(clientKey);
  if (attempts && now - attempts.firstAt > LOCKOUT_MS) failedAttempts.delete(clientKey);
  const current = failedAttempts.get(clientKey);
  if (current && current.count >= MAX_FAILED_ATTEMPTS) return "LOCKED";

  // Always run the password check so a wrong username takes as long as a wrong password.
  const passwordValid = await verifyPassword(password, hash);
  const usernameValid = safeEqual(username.trim().toUpperCase(), expectedUsername().toUpperCase());
  if (passwordValid && usernameValid) {
    failedAttempts.delete(clientKey);
    return "OK";
  }
  failedAttempts.set(clientKey, { count: (current?.count ?? 0) + 1, firstAt: current?.firstAt ?? now });
  return "INVALID";
}

export function clientKeyFor(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function developerSessionCookie(token: string) {
  return {
    name: DEVELOPER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: DEVELOPER_SESSION_TTL_MS / 1000,
  };
}

/** Test hook: forget failed login attempts. */
export function resetDeveloperLoginAttempts() {
  failedAttempts.clear();
}
