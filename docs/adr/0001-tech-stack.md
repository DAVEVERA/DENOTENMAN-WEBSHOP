# 0001. Tech stack

Date: 2026-04-21
Status: accepted

## Context

Greenfield webshop for DeNotenman. Single-author delivery (MNRV) plus a small set of sub-agents. Need end-to-end type safety, a flexible importer backed by the same schema as the storefront, and a path to production in four weeks without paying the complexity tax of microservices.

## Decision

Adopt a TypeScript monorepo managed by pnpm + Turborepo. Two Next.js 14 apps (storefront, admin) share a UI package. One NestJS API on Fastify with a BullMQ worker. PostgreSQL via Prisma. Zod schemas in a shared package drive validation on both sides. Stripe for payments, Cloudflare R2 for media, Neon for Postgres, Upstash for Redis, Vercel for frontends, Fly.io for API and worker. Vitest, Supertest, Playwright for tests. GitHub Actions for CI.

## Consequences

Positive:

- Single type language across frontend, backend, validation, and ORM.
- Shared Zod schemas prevent contract drift between UI and API.
- pnpm + Turborepo give fast installs and cached builds.
- NestJS gives structure (guards, interceptors, DI) without hand-rolling middleware.
- Each deploy target is managed, predictable, and replaceable.

Negative:

- Two hosting providers to monitor (Vercel + Fly.io).
- NestJS learning curve for contributors unfamiliar with decorators and DI.
- Monorepo tooling adds one layer of indirection in CI debugging.

## Alternatives considered

- **Remix + tRPC**: thinner, but loses OpenAPI generation and admin UX patterns from Nest.
- **Single Next.js app with route handlers**: simpler, but mixes storefront and admin concerns; harder to scope rate limits and background jobs.
- **Medusa / Saleor**: faster to start, but importer flexibility and the Dutch brand voice would require heavy template overrides.
- **Supabase only**: good DX, but row-level security plus a full admin workflow is more work than a plain Nest API for this scope.
