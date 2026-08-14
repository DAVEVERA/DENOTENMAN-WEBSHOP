// Uses the global Web Crypto API (crypto.subtle) rather than `node:crypto` so
// this works unmodified in both the Node.js runtime and the Edge runtime the
// proxy/middleware runs in.

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

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
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

export async function createAdminSessionToken(): Promise<string> {
  const expires = String(Date.now() + SESSION_TTL_MS);
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(expires));
  return `${expires}.${toHex(signature)}`;
}

export async function isValidAdminSessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const [expires, signatureHex] = token.split(".");
  if (!expires || !signatureHex) return false;

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const signatureBytes = fromHex(signatureHex);
  if (!signatureBytes) return false;

  try {
    const key = await getSigningKey();
    return crypto.subtle.verify("HMAC", key, signatureBytes as BufferSource, encoder.encode(expires));
  } catch {
    return false;
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

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) return false;

  return (
    constantTimeEqual(username, expectedUsername) &&
    constantTimeEqual(password, expectedPassword)
  );
}
