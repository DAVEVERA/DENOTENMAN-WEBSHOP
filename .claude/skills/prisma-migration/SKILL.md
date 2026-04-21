---
name: prisma-migration
description: Use for every Prisma schema change. Enforces a safe workflow — edit, migrate locally, review SQL, test, commit schema + migration together. Never auto-apply on boot; production uses prisma migrate deploy as an explicit release step.
---

## Workflow

### 1. Propose

State intent in one sentence. What field/table/index is added or changed, and why. File it under the consensus vote if the change is non-trivial (new table, FK change, index on high-write table, data migration).

### 2. Edit schema

Edit `prisma/schema.prisma`. Keep edits minimal — one logical change per migration.

### 3. Generate

```bash
pnpm prisma migrate dev --name <snake_case_name> --create-only
```

`--create-only` produces the SQL without applying. Open `prisma/migrations/<timestamp>_<name>/migration.sql` and read it.

### 4. Review SQL (checklist)

- Does it lock a large table? If so, plan for off-hours or use `CREATE INDEX CONCURRENTLY`.
- Does it add a `NOT NULL` column without default? If yes, split into three migrations: add nullable → backfill → add constraint.
- Does it drop a column still referenced anywhere? Grep the codebase first.
- Does it rename? Prisma will drop + create by default — write the rename as raw SQL (`ALTER TABLE ... RENAME COLUMN`) to preserve data.

### 5. Backfill (if needed)

If the migration needs a data step, add `data.sql` next to `migration.sql` and run it via a one-off script in `scripts/migrations/<timestamp>-<name>.ts`. Register in `package.json` as a named script. Never inline complex data changes in `migration.sql`.

### 6. Apply locally

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

Verify the schema matches expectations. Run the affected API tests.

### 7. Rollback rehearsal

Before committing, document the rollback in the migration folder as `ROLLBACK.md`:

```
Rollback:
  - Run: <command or SQL>
  - Data loss: <none | describe>
  - Duration estimate: <seconds>
```

If rollback is destructive, the consensus vote must explicitly accept that.

### 8. Commit

One commit: schema + migration + rollback note + any backfill script.

```
feat(prisma): add tsvector search column to product
```

### 9. Deploy

Production release pipeline runs:

```bash
pnpm prisma migrate deploy
```

As a pre-release step, gated behind manual approval for any migration marked `risky: true` in its folder.

## Forbidden

- Editing an existing migration after it has been committed.
- `prisma db push` against anything other than an ephemeral local DB.
- `migrate reset` against a preview or production DB.
- Renaming a table or column via Prisma's default drop+create path.

## Indexes

- Add indexes for every column in `where`, `orderBy`, or FK.
- In production-sized tables, use `CREATE INDEX CONCURRENTLY` in raw SQL, not the default generated `CREATE INDEX`.
- After adding, run `EXPLAIN ANALYZE` on the queries that use it and paste the result into the PR.
