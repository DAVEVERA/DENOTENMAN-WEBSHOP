# ADR 0011 — Sentry PII scrubbing and sample rates

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @app-admin
- **Context vote**: consensus-vote sprint 2 — top action #5

## Context

Sentry's defaults capture request bodies, headers, and user identifiers. For an EU webshop subject to GDPR this is unacceptable: order data contains names, addresses, and email addresses; auth flows contain credentials and tokens; Stripe webhooks contain signature headers that are essentially shared secrets. A single un-scrubbed event uploaded to Sentry's US-region infrastructure is an incident.

We also need to control cost and performance: 100% trace sampling on the storefront would balloon both. Session Replay is especially sensitive — recording an admin user editing a customer record is a data exfiltration vector.

Alternatives considered: (a) self-hosted Sentry — rejected, operational burden too high for sprint 2; (b) Sentry's hosted EU region with default settings — rejected, region change does not address content; (c) skip Sentry, use only structured logs — rejected, loses release health and frontend stack traces.

## Decision

In all four runtimes (storefront, admin, api, worker):

- `sendDefaultPii: false`.
- A `beforeSend` hook scrubs event payloads:
  - Headers stripped: `Authorization`, `Cookie`, `Set-Cookie`, `X-CSRF-Token`, `Stripe-Signature`.
  - Full request body redacted on routes matching `/auth/*`, `/checkout/*`, `/admin/*`.
  - Query-string parameters `token`, `code`, `session_id` replaced with `[REDACTED]`.
  - `event.user.email` and `event.user.ip_address` removed.
- Allowed tags: `release`, `environment`, `runtime`, `route`, `user_id_hash` (sha256 of the user id, truncated to 16 chars).
- Sample rates:
  - Storefront: traces `0.1`, profiles disabled.
  - Admin: traces `0.1`, profiles disabled.
  - API: traces `0.2`, profiles `0.1`.
  - Worker: traces `1.0`, profiles `0.1`.
- Session Replay:
  - Admin: **disabled**.
  - Storefront: `replaysSessionSampleRate: 0.05`, `replaysOnErrorSampleRate: 1.0`, with `maskAllText: true`, `maskAllInputs: true`, `blockAllMedia: true`.
  - Replay disabled entirely on `/checkout/*` and `/account/*` routes.

## Consequences

- **Positive**:
  - No PII leaves the application boundary unredacted.
  - Cost stays predictable; the worker keeps 100% traces because volume is low and visibility is high-value.
  - Replay is available where it helps debugging without recording sensitive flows.
- **Negative**:
  - Aggressive masking on storefront replays can make some bug reports harder to reproduce.
  - Storefront 10% trace sampling means rare bugs may not have a captured trace.
- **Trade-offs accepted**:
  - Lower observability fidelity in exchange for a defensible privacy posture.

## Implementation notes

- Source maps: use `hidden-source-map` in both Next.js apps so generated maps are not referenced from the deployed bundle.
- Upload via `@sentry/webpack-plugin` (or the framework-equivalent integration) with `deleteSourcemapsAfterUpload: true`.
- CI step verifies that no `.next/static/**/*.map` file exists in the deploy artifact. Build fails if any are found.
- `SENTRY_AUTH_TOKEN` is a CI secret only — never committed, never exposed to the runtime.
- A unit test per runtime exercises the `beforeSend` hook with a fixture event containing every banned header, body, and query parameter, and asserts each is removed or redacted. Failing this test blocks PR merge.
- DSNs are public-by-design but still loaded through `EnvService` (ADR 0010) so missing config crashes at boot.
- `release` tag set from CI commit SHA; `environment` set from `NODE_ENV` and Fly/Vercel environment.

## References

- Consensus vote architect/auditor/@app-admin — sprint 2, top action #5
- Sentry docs — Data scrubbing and `beforeSend`
- Sentry docs — Session Replay privacy controls
- GDPR Art. 5(1)(c) — data minimisation
