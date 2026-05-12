// TODO (PR-C): add *.ingest.sentry.io to CSP connect-src in the admin middleware.
import * as Sentry from "@sentry/nextjs";
import {
  beforeSend as _beforeSend,
  beforeSendTransaction as _beforeSendTransaction,
} from "./src/lib/sentry-init";
import type { ScrubbableEvent } from "@denotenman/utils";

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type BeforeSendFn = NonNullable<InitOptions["beforeSend"]>;
type BeforeSendTxFn = NonNullable<InitOptions["beforeSendTransaction"]>;
type SentryErrorEvent = Parameters<BeforeSendFn>[0];
type SentryTxEvent = Parameters<BeforeSendTxFn>[0];
type SentryHint = Parameters<BeforeSendFn>[1];

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

// ADR 0011: replay disabled entirely for admin.
if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    // ADR 0011: admin traces 0.1, no replay.
    tracesSampleRate: 0.1,
    beforeSend(event: SentryErrorEvent, hint: SentryHint): SentryErrorEvent | null {
      return _beforeSend(event as unknown as ScrubbableEvent, hint) as SentryErrorEvent | null;
    },
    beforeSendTransaction(event: SentryTxEvent, hint: SentryHint): SentryTxEvent | null {
      return _beforeSendTransaction(
        event as unknown as ScrubbableEvent,
        hint,
      ) as SentryTxEvent | null;
    },
  });
}
