import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

import { CANVA_API_BASE } from "./config";

// Verifies the correlation_jwt Canva adds when an editor clicks "Return to …".
// Signed with RS256 by keys published at /v1/connect/keys; the audience is our client ID.

export type CanvaReturn = { designId: string; correlationState: string | null };

type Jwk = JsonWebKey & { kid?: string };

function decodePart(part: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

async function canvaKeys(fetchImpl: typeof fetch, now: number): Promise<Jwk[]> {
  if (cachedKeys && now - cachedKeys.fetchedAt < 60 * 60 * 1000) return cachedKeys.keys;
  const response = await fetchImpl(`${CANVA_API_BASE}/v1/connect/keys`, { signal: AbortSignal.timeout(10_000) });
  const body = await response.json().catch(() => null) as { keys?: Jwk[] } | null;
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  cachedKeys = { keys, fetchedAt: now };
  return keys;
}

export async function verifyCanvaReturnToken(
  token: string,
  clientId: string,
  options: { fetchImpl?: typeof fetch; now?: number; keys?: Jwk[] } = {},
): Promise<CanvaReturn | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (!header || !payload || header.alg !== "RS256") return null;
  const now = options.now ?? Date.now();
  let keys: Jwk[];
  try {
    keys = options.keys ?? await canvaKeys(options.fetchImpl ?? fetch, now);
  } catch {
    return null;
  }
  const jwk = keys.find((key) => key.kid === header.kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) return null;
  try {
    const valid = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
    if (!valid) return null;
  } catch {
    return null;
  }
  const audience = payload.aud;
  const audienceOk = Array.isArray(audience) ? audience.includes(clientId) : audience === clientId;
  if (!audienceOk) return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 < now) return null;
  if (typeof payload.design_id !== "string" || !payload.design_id) return null;
  return {
    designId: payload.design_id,
    correlationState: typeof payload.correlation_state === "string" ? payload.correlation_state : null,
  };
}

/** What the admin portal packs into correlation_state: where to go back to, and which field asked. */
export type CanvaCorrelation = { returnTo: string; pickerId: string | null };

export function encodeCorrelation(value: CanvaCorrelation): string {
  return Buffer.from(JSON.stringify({ r: value.returnTo, p: value.pickerId })).toString("base64url");
}

/** Only admin paths on our own site are accepted as a place to return to. */
export function safeAdminPath(value: unknown): string {
  return typeof value === "string" && /^\/admin(?:\/[\w\-./%]*)?(?:\?[\w\-.=&%]*)?$/u.test(value) && !value.includes("//") ? value : "/admin";
}

export function decodeCorrelation(value: string | null): CanvaCorrelation {
  if (!value) return { returnTo: "/admin", pickerId: null };
  const parsed = decodePart(value);
  return {
    returnTo: safeAdminPath(parsed?.r),
    pickerId: typeof parsed?.p === "string" && /^[\w-]{1,40}$/u.test(parsed.p) ? parsed.p : null,
  };
}
