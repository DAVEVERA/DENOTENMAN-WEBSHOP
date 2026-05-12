// TODO (PR-C): add *.ingest.sentry.io to CSP connect-src in the storefront middleware.
import * as Sentry from "@sentry/nextjs";
import {
  beforeSend as _beforeSend,
  beforeSendTransaction as _beforeSendTransaction,
  beforeBreadcrumb as _beforeBreadcrumb,
} from "./src/lib/sentry-init";
import type { ScrubbableEvent } from "@denotenman/utils";

// Derive hook parameter types from Sentry.init to stay within the declared API
// surface of @sentry/nextjs without importing unexported internals.
type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;
type BeforeSendFn = NonNullable<InitOptions["beforeSend"]>;
type BeforeSendTxFn = NonNullable<InitOptions["beforeSendTransaction"]>;
type BeforeBreadcrumbFn = NonNullable<InitOptions["beforeBreadcrumb"]>;
type SentryErrorEvent = Parameters<BeforeSendFn>[0];
type SentryTxEvent = Parameters<BeforeSendTxFn>[0];
type SentryHint = Parameters<BeforeSendFn>[1];
type SentryBreadcrumb = Parameters<BeforeBreadcrumbFn>[0];
type SentryBreadcrumbHint = Parameters<BeforeBreadcrumbFn>[1];

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    // ADR 0011: storefront traces 0.1, replay session 0.05, replay on error 1.0.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event: SentryErrorEvent, hint: SentryHint): SentryErrorEvent | null {
      return _beforeSend(event as unknown as ScrubbableEvent, hint) as SentryErrorEvent | null;
    },
    beforeSendTransaction(event: SentryTxEvent, hint: SentryHint): SentryTxEvent | null {
      return _beforeSendTransaction(
        event as unknown as ScrubbableEvent,
        hint,
      ) as SentryTxEvent | null;
    },
    beforeBreadcrumb(
      breadcrumb: SentryBreadcrumb,
      hint?: SentryBreadcrumbHint,
    ): SentryBreadcrumb | null {
      return _beforeBreadcrumb(
        breadcrumb as unknown as Parameters<typeof _beforeBreadcrumb>[0],
        hint,
      ) as SentryBreadcrumb | null;
    },
  });
}
