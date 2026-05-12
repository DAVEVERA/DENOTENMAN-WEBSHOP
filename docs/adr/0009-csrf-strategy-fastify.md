# ADR 0009 — CSRF strategy in Fastify

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @backend-dev
- **Context vote**: consensus-vote sprint 2 — top action #2

## Context

The API serves two authentication modes simultaneously:

- **Cookie-based sessions** for the admin UI and the storefront account pages. The browser attaches the session cookie to any same-site request, so cross-site forgeries are possible against state-changing endpoints.
- **Bearer tokens** for the public storefront API surface and any future third-party integrations. Bearer auth is not vulnerable to CSRF because the browser does not auto-attach an `Authorization` header.

A single CSRF policy applied to every route would either break Bearer clients (forcing them to fetch a CSRF token they don't need) or leave cookie endpoints exposed. The Stripe webhook is a special case: it is unauthenticated from the browser's perspective and is verified entirely by HMAC signature, so CSRF protection there is both meaningless and actively harmful (the token would not exist).

Alternatives considered: (a) `SameSite=Strict` on the session cookie alone — rejected, top-level POST navigations and some link prefetchers can still leak; defense-in-depth requires an explicit token; (b) custom-header-only CSRF (no cookie) — rejected, doesn't survive cross-origin admin tooling we may need later; (c) drop cookie auth entirely — rejected, makes the admin UX worse for no real gain.

## Decision

Adopt `@fastify/csrf-protection` using the double-submit cookie pattern. The plugin is registered globally and applied as a `preHandler` on every `POST`, `PUT`, `PATCH`, and `DELETE` route that accepts cookie authentication. Routes that accept only Bearer authentication are exempt. The Stripe webhook route is explicitly exempt (its HMAC signature is the auth).

A `GET /auth/csrf` endpoint issues a fresh CSRF token pair to the client. The client then submits the token in the `X-CSRF-Token` header on every state-changing request; the plugin validates it against the secret cookie.

## Consequences

- **Positive**:
  - State-changing admin endpoints cannot be forged from a malicious origin.
  - Bearer clients are unaffected — no token dance, no extra round trip.
  - Stripe webhook remains verifiable purely by signature.
- **Negative**:
  - Any new admin endpoint must remember to be inside the cookie-auth path; misclassification leaves a hole. Mitigated by guard tests in PR-D.
  - Front-end must read `csrf-token` cookie and forward it as a header — extra plumbing in the storefront fetch wrapper.
- **Trade-offs accepted**:
  - Two cookies per session (token + secret) instead of one, in exchange for CSRF coverage that does not depend on `SameSite` alone.

## Implementation notes

- Exempt list, hard-coded in the plugin registration: `/v1/stripe/webhook`, plus every route decorated with `@PublicApi()` (which by contract accepts only Bearer tokens). The exempt list lives in one file; auditor reviews diffs touching it.
- Cookie attributes:
  - `csrf-token`: `HttpOnly=false` (front-end must read it for the double-submit), `Secure`, `SameSite=Strict`, `Path=/`.
  - `csrf-secret`: `HttpOnly=true`, `Secure`, `SameSite=Strict`, `Path=/`.
- `@PublicApi()` decorator must be defined and applied via a metadata reflector that the CSRF preHandler reads. No string-matching on URLs.
- Tests required: (a) `POST /v1/admin/products` with valid cookie session but no `X-CSRF-Token` → `403`; (b) same call with valid token → `2xx`; (c) `POST` to a `@PublicApi()` route with Bearer token and no CSRF token → `2xx`; (d) `POST /v1/stripe/webhook` with valid Stripe signature and no CSRF → `200`.
- Token rotation is per-session, not per-request, to keep the front-end simple. Re-issued on login and logout.

## References

- Consensus vote architect/auditor/@backend-dev — sprint 2, top action #2
- OWASP CSRF Prevention Cheat Sheet
- `@fastify/csrf-protection` README — double-submit cookie mode
