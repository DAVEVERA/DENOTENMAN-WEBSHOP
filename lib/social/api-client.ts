import "server-only";

import { SocialError } from "./errors";

export type SocialFetch = typeof fetch;

/** Calls a platform API and turns its failures into Dutch, typed errors. */
export async function platformJson<T>(
  label: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  fetchImpl: SocialFetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000), cache: "no-store" });
  } catch {
    throw new SocialError("PLATFORM_UNREACHABLE", `${label} is niet bereikbaar.`, 503, true);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = platformErrorMessage(body) ?? `HTTP ${response.status}`;
    if (response.status === 401) throw new SocialError("TOKEN_REJECTED", `${label} weigert de koppeling (${detail}). Verbind het account opnieuw.`, 502);
    const retryable = response.status === 429 || response.status >= 500;
    throw new SocialError(retryable ? "PLATFORM_BUSY" : "PLATFORM_REJECTED", `${label}: ${detail}`, 502, retryable);
  }
  return body as T;
}

function platformErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return typeof record.error_description === "string" ? record.error_description : error;
  if (error && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message) return nested.message;
    if (typeof nested.code === "string" && nested.code !== "ok") return nested.code;
  }
  return null;
}

export function form(values: Record<string, string>): { body: string; headers: Record<string, string> } {
  return { body: new URLSearchParams(values).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } };
}

export async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
