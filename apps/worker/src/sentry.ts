import * as childProcess from "node:child_process";
import * as Sentry from "@sentry/node";
import type { ErrorEvent, EventHint } from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import pino from "pino";

// ---------------------------------------------------------------------------
// Internal logger — only used during init, before NestJS logger is available.
// ---------------------------------------------------------------------------
const log = pino({ name: "sentry-init" });

// ---------------------------------------------------------------------------
// Sensitive header names — stripped from every captured event.
// ---------------------------------------------------------------------------
const REDACTED_HEADERS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "stripe-signature",
]);

// ---------------------------------------------------------------------------
// Routes whose full request body must be stripped.
// ---------------------------------------------------------------------------
const BODY_REDACT_PREFIXES: readonly string[] = ["/v1/auth/", "/v1/checkout", "/v1/admin/"];

// ---------------------------------------------------------------------------
// Query-string parameter names that must be redacted (case-insensitive).
// ---------------------------------------------------------------------------
const REDACTED_QUERY_PARAMS: ReadonlySet<string> = new Set(["token", "code", "session_id"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redactHeaders(
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

function redactQueryString(query: string | undefined): string | undefined {
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

function shouldRedactBody(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  const path = url.split("?")[0] ?? "";
  return BODY_REDACT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Derive the transaction event type from Sentry's own init options to avoid
// importing the unexported TransactionEvent from @sentry/core directly.
type SentryInitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type TransactionEvent = NonNullable<
  Parameters<NonNullable<SentryInitOptions["beforeSendTransaction"]>>[0]
>;

// ---------------------------------------------------------------------------
// beforeSend — PII scrub per ADR 0011
// ---------------------------------------------------------------------------
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  const req = event.request;
  if (req) {
    req.headers = redactHeaders(req.headers);
    req.query_string = redactQueryString(
      typeof req.query_string === "string" ? req.query_string : undefined,
    );
    if (shouldRedactBody(req.url)) {
      req.data = "[REDACTED]";
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  return event;
}

// ---------------------------------------------------------------------------
// beforeSendTransaction — header/query redaction only (less strict per ADR 0011)
// ---------------------------------------------------------------------------
export function beforeSendTransaction(
  event: TransactionEvent,
  _hint: EventHint,
): TransactionEvent | null {
  const req = event.request;
  if (req) {
    req.headers = redactHeaders(req.headers);
    req.query_string = redactQueryString(
      typeof req.query_string === "string" ? req.query_string : undefined,
    );
  }
  return event;
}

// ---------------------------------------------------------------------------
// Release resolution — git SHA when available, 'unknown' otherwise.
// ---------------------------------------------------------------------------
function resolveRelease(): string {
  const fromEnv = process.env.SENTRY_RELEASE ?? process.env.FLY_APP_NAME;
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return childProcess.execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------
let initialised = false;

// ---------------------------------------------------------------------------
// initSentry — call before NestFactory.create(). Safe to call multiple times.
// Worker uses tracesSampleRate: 1.0 (low volume, high-value visibility per ADR 0011).
// ---------------------------------------------------------------------------
export function initSentry(): void {
  if (initialised) {
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    log.info("Sentry disabled (no DSN)");
    initialised = true;
    return;
  }

  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

  Sentry.init({
    dsn,
    environment,
    release: resolveRelease(),
    sendDefaultPii: false,
    tracesSampleRate: 1.0,
    profilesSampleRate: 0.1,
    integrations: [nodeProfilingIntegration()],
    beforeSend,
    beforeSendTransaction,
  });

  initialised = true;
}
