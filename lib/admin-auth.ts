import { prisma } from "@/lib/prisma";
import type { AdminUser } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/pbkdf2-password";

export const ADMIN_SESSION_COOKIE = "denotenman_admin_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const encoder = new TextEncoder();

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return value;
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export const hashAdminPassword = hashPassword;

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.active) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function createAdminSessionToken(userId: string): Promise<string> {
  const expires = String(Date.now() + SESSION_TTL_MS);
  const payload = `${userId}.${expires}`;
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export type AdminSession = { userId: string; expiresAt: number };

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminSession | null> {
  if (!token) return null;

  const [userId, expires, signatureHex] = token.split(".");
  if (!userId || !expires || !signatureHex) return null;

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const signatureBytes = fromHex(signatureHex);
  if (!signatureBytes) return null;

  try {
    const key = await getSigningKey();
    const payload = `${userId}.${expires}`;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as BufferSource,
      encoder.encode(payload)
    );
    return valid ? { userId, expiresAt } : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
