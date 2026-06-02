// TODO (PR-C): add *.ingest.sentry.io to CSP connect-src in the admin middleware.
import { scrubEvent, scrubTransactionEvent, type ScrubbableEvent } from "@denotenman/utils";

// Hook signatures use ScrubbableEvent rather than Sentry's own ErrorEvent /
// TransactionEvent which carry any-typed index signatures. The casts in
// sentry.client.config.ts and sentry.server.config.ts bridge the gap.

export function beforeSend(event: ScrubbableEvent, _hint: unknown): ScrubbableEvent | null {
  return scrubEvent(event);
}

export function beforeSendTransaction(
  event: ScrubbableEvent,
  _hint: unknown,
): ScrubbableEvent | null {
  return scrubTransactionEvent(event);
}
