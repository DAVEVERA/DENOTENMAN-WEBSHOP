const encoder = new TextEncoder();
const UNDO_TTL_MS = 10_000;

export type ProductVisibilityUndoPayload = {
  productId: string;
  adminUserId: string;
  currentIsActive: boolean;
  targetIsActive: boolean;
  version: string;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return value;
}
async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    return new Uint8Array(Buffer.from(value, "base64url"));
  } catch {
    return null;
  }
}

export async function createProductVisibilityUndoToken(
  input: Omit<ProductVisibilityUndoPayload, "expiresAt">,
  now = Date.now(),
): Promise<string> {
  const payload: ProductVisibilityUndoPayload = {
    ...input,
    expiresAt: now + UNDO_TTL_MS,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyProductVisibilityUndoToken(
  token: string | null | undefined,
  expected: Omit<ProductVisibilityUndoPayload, "expiresAt">,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;
  const signature = fromBase64Url(encodedSignature);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!signature || !payloadBytes) return false;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      signature as BufferSource,
      encoder.encode(encodedPayload),
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as ProductVisibilityUndoPayload;
    return payload.expiresAt >= now
      && payload.productId === expected.productId
      && payload.adminUserId === expected.adminUserId
      && payload.currentIsActive === expected.currentIsActive
      && payload.targetIsActive === expected.targetIsActive
      && payload.version === expected.version;
  } catch {
    return false;
  }
}
