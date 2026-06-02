# ADR 0010 — EnvService with Zod validation

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @app-admin
- **Context vote**: consensus-vote sprint 2 — top action #5

## Context

`process.env.X` is currently dereferenced directly across the codebase. A missing or malformed `JWT_ACCESS_SECRET` is only discovered when the first authentication call fails in production — minutes or hours after deploy. We want fail-fast at boot: a misconfigured environment must crash the process before it accepts traffic, and the error must name the missing key.

A naive solution — one shared `packages/env` schema imported everywhere — does not work in our monorepo. Next.js distinguishes server-only secrets from `NEXT_PUBLIC_*` values, and bundling a server-side schema into a client bundle leaks the names of secrets and breaks the build. The API and worker have their own server-only requirements (database URL, Stripe secret, Redis URL). Each app needs its own validated surface.

Alternatives considered: (a) one shared schema package — rejected, conflates Next client/server boundaries; (b) `@nestjs/config` defaults — rejected, no compile-time types and no fail-fast guarantee; (c) `dotenv-safe` with `.env.example` — rejected, only checks presence not shape (a string of length 0 passes).

## Decision

Each app owns its env contract:

- `apps/storefront/src/env.ts` — two Zod schemas, one for server, one for `NEXT_PUBLIC_*`.
- `apps/admin/src/env.ts` — same split.
- `apps/api/src/env.ts` — single server-side schema.
- `apps/worker/src/env.ts` — single server-side schema.

A shared helper `packages/utils/env.ts` exports `parseEnv<T>(schema, source)` that runs the schema against a source object, formats Zod errors as a single human-readable block, logs it, and throws on any failure. Every app calls `parseEnv` once at module load before any other side-effecting import. There is **no** `packages/env` package.

## Consequences

- **Positive**:
  - Production processes refuse to boot with a missing or malformed env. The crash trace names the offending key.
  - Each app has a typed `env` object — no more `process.env.FOO!` casts.
  - Next.js client/server boundary is preserved per app.
- **Negative**:
  - Some duplication of common keys (e.g., `NODE_ENV`, `SENTRY_DSN`) across app schemas. Acceptable cost for correctness.
  - Adding a new env var means editing the schema in the app that uses it — auditor enforces this in PR review.
- **Trade-offs accepted**:
  - Per-app schemas instead of one shared schema, in exchange for not breaking Next.js semantics.

## Implementation notes

- Production: any `parseEnv` failure throws a fatal error before the HTTP server binds.
- Development: optional keys may warn-and-continue; required keys still throw. The schema marks the boundary explicitly (`.optional()` vs required).
- Tests use a factory `buildTestEnv(overrides)` that returns a frozen, validated env object. Tests do **not** mutate `process.env`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: `z.string().min(32)`. Schemas reject anything shorter.
- `STRIPE_SECRET_KEY`: optional in preview environments (`NODE_ENV !== 'production'`), required in production. Encoded as a refinement on the schema, not a runtime branch.
- `DATABASE_URL`, `REDIS_URL`: validated as `z.string().url()` with protocol check.
- The Next.js client schema is a strict whitelist — only keys starting with `NEXT_PUBLIC_` are accepted, and unknown keys fail the parse.
- CI runs `pnpm --filter <app> exec tsc --noEmit` over `env.ts` to confirm the schema typechecks.

## References

- Consensus vote architect/auditor/@app-admin — sprint 2, top action #5
- Next.js docs — Environment variables (server vs `NEXT_PUBLIC_*`)
- Zod docs — `safeParse` and error formatting
