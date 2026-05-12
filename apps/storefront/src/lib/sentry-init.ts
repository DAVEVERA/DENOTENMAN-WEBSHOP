// TODO (PR-C): add *.ingest.sentry.io to CSP connect-src in middleware.
// Sentry's upstream Event/Breadcrumb types contain `{ [key: string]: any }` data
// fields. We work with our own ScrubbableEvent shape and cast only at the
// Sentry API boundary, keeping this module free of implicit any propagation.
import { scrubEvent, scrubTransactionEvent, type ScrubbableEvent } from "@denotenman/utils";

// Hook signatures are declared using ScrubbableEvent rather than Sentry's
// own ErrorEvent/TransactionEvent which carry any-typed index signatures.
// The casts in sentry.client.config.ts / sentry.server.config.ts bridge the gap.

export function beforeSend(event: ScrubbableEvent, _hint: unknown): ScrubbableEvent | null {
  return scrubEvent(event);
}

export function beforeSendTransaction(
  event: ScrubbableEvent,
  _hint: unknown,
): ScrubbableEvent | null {
  return scrubTransactionEvent(event);
}

interface BreadcrumbData {
  to?: string;
  [key: string]: unknown;
}

interface NavigationBreadcrumb {
  category?: string;
  data?: BreadcrumbData;
  [key: string]: unknown;
}

function redactBreadcrumbUrl(url: string): string {
  const [path, qs] = url.split("?");
  if (!qs) {
    return url;
  }
  const cleaned = qs
    .split("&")
    .map((part) => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) {
        return part;
      }
      const key = part.slice(0, eqIdx).toLowerCase();
      if (key === "token" || key === "code" || key === "session_id") {
        return `${part.slice(0, eqIdx)}=[REDACTED]`;
      }
      return part;
    })
    .join("&");
  return `${path}?${cleaned}`;
}

export function beforeBreadcrumb(
  breadcrumb: NavigationBreadcrumb,
  _hint?: unknown,
): NavigationBreadcrumb | null {
  // Strip query-string params from navigation breadcrumb urls so token/code
  // values are not stored in the breadcrumb trail.
  if (breadcrumb.category === "navigation" && typeof breadcrumb.data?.to === "string") {
    return {
      ...breadcrumb,
      data: {
        ...breadcrumb.data,
        to: redactBreadcrumbUrl(breadcrumb.data.to),
      },
    };
  }
  return breadcrumb;
}
