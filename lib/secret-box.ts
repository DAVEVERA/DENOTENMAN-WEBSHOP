import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Encrypts credentials (payment keys, OAuth tokens) before they are stored.
// Each purpose derives its own key from ADMIN_SESSION_SECRET.
// Format: v1.<iv>.<tag>.<ciphertext>, all base64url, AES-256-GCM.

function key(purpose: string): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(purpose).digest();
}

export function sealWithPurpose(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Null when the value cannot be decrypted, for example after the admin secret was rotated. */
export function openWithPurpose(sealed: string | null | undefined, purpose: string): string | null {
  if (!sealed) return null;
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
