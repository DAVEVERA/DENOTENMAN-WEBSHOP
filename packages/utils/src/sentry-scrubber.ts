// Sensitive headers stripped from every captured Sentry event (ADR 0011).
const REDACTED_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "stripe-signature",
]);

// Routes whose full request body must be removed.
const BODY_REDACT_PREFIXES: readonly string[] = [
  "/api/auth/",
  "/checkout",
  "/account",
  "/admin",
  "/v1/auth/",
  "/v1/checkout",
  "/v1/admin/",
];

// Query-string parameter names that must be replaced (case-insensitive).
const REDACTED_QUERY_PARAMS: ReadonlySet<string> = new Set(["token", "code", "session_id"]);

export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return out;
}

export function redactQueryString(query: string | undefined): string | undefined {
  if (!query) {
    return query;
  }
  const qs = query.startsWith("?") ? query.slice(1) : query;
  const parts = qs.split("&").map((part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      return part;
    }
    const key = part.slice(0, eqIdx);
    return REDACTED_QUERY_PARAMS.has(key.toLowerCase()) ? `${key}=[REDACTED]` : part;
  });
  return parts.join("&");
}

export function shouldRedactBody(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  const path = url.split("?")[0] ?? "";
  return BODY_REDACT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Minimal shape of a Sentry event relevant to scrubbing — avoids importing
// Sentry directly into this pure-utility package.
export interface ScrubbableRequest {
  headers?: Record<string, string> | undefined;
  query_string?: string | undefined;
  url?: string | undefined;
  data?: unknown;
}

export interface ScrubbableEvent {
  request?: ScrubbableRequest | undefined;
  user?: Record<string, unknown> | undefined;
}

/**
 * Scrubs PII from a Sentry event per ADR 0011.
 * Mutates and returns the event so it can be used directly as a beforeSend return value.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const req = event.request;
  if (req !== undefined) {
    if (req.headers !== undefined) {
      req.headers = redactHeaders(req.headers);
    }
    if (req.query_string !== undefined) {
      req.query_string = redactQueryString(req.query_string);
    }
    if (shouldRedactBody(req.url)) {
      req.data = "[REDACTED]";
    }
  }

  if (event.user !== undefined) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  return event;
}

/**
 * Scrubs headers and query string from a transaction event.
 * Body is NOT redacted on transactions — only on error events (ADR 0011).
 */
export function scrubTransactionEvent<T extends ScrubbableEvent>(event: T): T {
  const req = event.request;
  if (req !== undefined) {
    if (req.headers !== undefined) {
      req.headers = redactHeaders(req.headers);
    }
    if (req.query_string !== undefined) {
      req.query_string = redactQueryString(req.query_string);
    }
  }
  return event;
}
