# 0002. Data model

Date: 2026-04-21
Status: accepted

## Context

The schema must serve three consumers simultaneously: storefront queries (fast reads, SEO-friendly slugs), admin CRUD, and the importer (bulk upserts with dedup). It must also produce an audit trail usable for 24-hour undo of import batches.

## Decision

- **Money in integer cents**, currency fixed to EUR for v1. Avoids float precision bugs and keeps Stripe interop trivial.
- **UUID primary keys** across all user-facing entities. Safer to expose than autoincrement ints; compatible with distributed writes if ever needed.
- **Timestamps as `Timestamptz(6)` in UTC**. All app-level formatting converts to Europe/Amsterdam on render.
- **Soft delete** on `Product`, `ProductVariant`, `Category` via `deletedAt`. A Prisma client extension filters `deletedAt: null` by default so developers cannot forget.
- **Single variant per product always**. Simple products carry one `ProductVariant` row — queries and cart logic don't branch between "simple" and "variable" products.
- **Slug uniqueness** scoped to parent for `Category` (sibling uniqueness). Global unique for `Product.slug` so URLs are stable regardless of category moves.
- **Audit log carries `before`/`after` JSON snapshots** on every admin mutation. Undo of import batches walks the snapshots for each `ImportRow` within 24 hours of `completedAt`.
- **Importer has its own `ImportRow` table** rather than staging rows in `Product`. Keeps validation state visible and lets us retry or skip rows without polluting the product table.
- **Cart expiry via `expiresAt`** with a periodic worker job that deletes expired anonymous carts. No manual cleanup needed.
- **Refresh tokens hashed at rest** with a unique index on `tokenHash`. Rotating by issuing a new token and revoking the old one in the same transaction.
- **Full-text search** on `Product` via a generated `tsvector` column with a GIN index, built in a migration after the base schema lands. Keeps v1 search free of external dependencies.

## Consequences

Positive:

- Storefront reads are straightforward Prisma `findMany` calls with predictable indexes.
- Importer can dry-run validate an entire batch before touching `Product` at all.
- Undo is a mechanical walk of `AuditLog` entries — no special-case logic.
- Money and timestamps behave the same everywhere.

Negative:

- Every product has a variant row even when there's conceptually only one. Acceptable — the cost is one extra row and one extra JOIN.
- Soft delete requires discipline. Mitigated by the Prisma extension that applies the filter by default.
- JSON `before`/`after` grows with audit activity. Retention job trims entries older than two years.

## Alternatives considered

- **Price as decimal**: rejected. Float/decimal mismatches with Stripe's cent-based amounts create recurring reconciliation bugs.
- **Hard delete with history table**: rejected. More moving parts than `deletedAt`, same effective outcome.
- **Polymorphic product/variant**: rejected. Splitting "simple" vs "variable" products requires two code paths forever.
- **Meilisearch / Typesense for search**: deferred. Postgres full-text meets v1 needs; revisit if catalog exceeds ~2000 products or search UX demands facets.
