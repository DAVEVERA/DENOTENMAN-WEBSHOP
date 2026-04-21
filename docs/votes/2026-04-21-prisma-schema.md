# Prisma schema — initial data model

Date: 2026-04-21
Type: schema
Outcome: approved

## Proposal

TITLE: Initial Prisma schema for DeNotenman monorepo
TYPE: schema
CHANGE: Land the full data model (18 models, 5 enums) covering catalog, auth, cart, checkout, shipping, importer, and audit log. Adds tsvector full-text column on Product in a follow-up migration.
REASON: Sprint 1 cannot start without a stable schema. All downstream work (API, importer, storefront) depends on these shapes. Shipping one coherent schema once is cheaper than drip-feeding tables.
RISK: Locking in data decisions early. Mitigated by ADR 0002 documenting the rationale and by soft delete everywhere, which lets us evolve without destructive migrations.
ROLLBACK: `prisma migrate reset` against a dev DB. No production data exists yet, so no data-loss risk for this vote.

## Votes

- architect: APPROVE — Matches the build prompt (Section 4). ADR 0002 covers all non-obvious choices.
- auditor: APPROVE — Money in cents, UUIDs, argon2 for passwords, RefreshToken hashed at rest, AuditLog present on every admin entity. No attribution. No `any` in the seed script. Passes merge gate.
- database-dev: APPROVE — FK-indexed throughout. Soft-delete pattern enforced via extension (follow-up in sprint 1). Unique constraint on Category scoped by parentId is the right call. tsvector deferred to follow-up migration as planned.

## Decision

Approved. Merge `prisma/schema.prisma`, `prisma/seed.ts`, and ADR 0002 in a single commit:

```
feat(prisma): initial data model for catalog, cart, checkout, importer, audit
```

Follow-ups tracked as separate tasks:

1. Generate the first migration (`prisma migrate dev --name init`).
2. Prisma client extension for soft-delete filtering.
3. Migration adding tsvector generated column + GIN index on Product.
