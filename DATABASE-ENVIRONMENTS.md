# Database environments

The existing Neon database is reserved for production:

- Host: `ep-small-pond-b2su7ww7.c-6.eu-central-1.aws.neon.tech` (including its pooled endpoint).
- Database: `neondb`.
- Service: `denotenman-webshop`, project `project-5dc79156-4200-4528-bfc`, region `europe-west4`.
- Credential source for production: Secret Manager `denotenman-database-url`.

Production is moving to Cloud SQL (see "Cloud SQL migration" below). Until the
cutover, Neon above stays the live database.

Local development uses a PostgreSQL 18 container with the same collation as
production (`C.UTF-8`):

```sh
docker compose -f docker-compose.dev.yml up -d
# .env.local
DATABASE_URL="postgresql://denotenman:denotenman@127.0.0.1:15432/denotenman_dev"
```

The local database is named `denotenman_dev` on purpose: a loopback host with the
database name `neondb` is treated as production (it is what a Cloud SQL Auth
Proxy to production looks like). Port 15432 avoids Windows' reserved port ranges.
Do not use the production URL to make local startup or tests pass.

## Cloud SQL migration

- Instance: `project-5dc79156-4200-4528-bfc:europe-west4:denotenman-db`
  (PostgreSQL 18, `db-f1-micro`, max 25 connections, daily backups, 7 days
  point-in-time recovery, deletion protection, public IP without authorized
  networks: reachable only through the Cloud SQL connector or Auth Proxy).
- Databases: `neondb` (production, owner `webshop`) and `neondb_rehearsal`
  (rehearsal copy), both with collation `C.UTF-8`.
- Secrets: `denotenman-cloudsql-database-url` (socket URL for Cloud Run,
  `connection_limit=3`) and `denotenman-cloudsql-postgres-password` (admin, not
  granted to any service account).
- Cloud Run reaches the socket URL after `--add-cloudsql-instances`; Cloud Build
  reaches it through a proxy container (`scripts/ci/cloudsql-url.sh`). With a
  Neon `DATABASE_URL` the release pipeline behaves exactly as before.
- One-off data copy: `powershell -File scripts/cloudsql-migration.ps1 -Mode rehearsal`
  copies production Neon into `neondb_rehearsal` and compares both with
  `scripts/compare-databases.cjs`. `-Mode cutover` refuses unless `neondb` is
  empty, then freezes Neon itself (`default_transaction_read_only = on`, open
  sessions of the app role closed), copies and compares. `-Mode unfreeze` is the
  rollback: it makes Neon writable again. Cutover and unfreeze ask for
  confirmation unless `-Confirmed` is passed. Run a mode only from a committed
  state; the commit hash is recorded as `DEPLOYMENT_VERSION`.
- Cutover must switch the Cloud Run secret reference to
  `denotenman-cloudsql-database-url` on a new revision (not a new version of
  `denotenman-database-url`, which older revisions read as `latest`), together
  with `--add-cloudsql-instances` and `--max-instances=5`, and switch the
  `availableSecrets` entry in `cloudbuild-trigger.yaml` in the same release.

## Enforced application checks

`lib/database-access.cjs` rejects the production endpoint for local application
startup, tests, seeds and development migrations, including direct Prisma CLI
commands through `prisma.config.ts`. The normal Prisma client also checks the
target before construction. Prisma generation and schema validation remain
available without a database connection. With no configured URL, these offline
commands receive an inert localhost URL solely for schema parsing.

The live application is recognized by `NODE_ENV=production`, Cloud Run's
`K_SERVICE=denotenman-webshop`, and its `K_REVISION`. A production build or
`migrate deploy` requires `DATABASE_ACCESS_CONTEXT=release` together with a full
40-character `DEPLOYMENT_VERSION`. Cloud Build supplies these for the committed
release. Never set these flags in local env files. They are operational checks,
not a substitute for database roles, restricted credentials or network access.

Database-backed tests need a separate test target. Do not bypass a failed
production-target check. Pure policy tests use fake URLs without connecting:

```sh
node --test tests/database-access.test.mjs
```

`components/admin` contains a separate older Supabase application and is excluded
from the current webshop container build. It is not the database for `/admin`.

No schema migration, production data update or credential rotation is implied by
these checks. Production changes still use the reviewed release process.

## Reader-first release and rollback

The live release based on `2d130c8` cannot deserialize `BACK_IN_STOCK` in
`AftersalesTrigger` or `ORDER_CANCELLATION_REQUESTED` in `BusinessEventType`.
Adding those enum values to PostgreSQL does not update an already-built Prisma
client. Do not create these enum-bearing rows while that release is still a
traffic target or the designated rollback target.

`RELEASE_EXPANDED_ENUM_WRITES` is a runtime-only activation flag. Only the exact
value `true` enables new enum writes. Missing, empty and other values are off.
The release pipeline explicitly deploys with it off:

- The editable stock-notification step is not auto-created yet. Existing stock
  notifications retain their existing fallback template. Existing configured
  steps are neither removed nor reset.
- Partial cancellation still creates the full request, its items, and an audit
  entry. Until activation that entry uses the existing `ORDER_LIST_NOTE_ADDED`
  category; its summary and `metadata.eventType` identify the cancellation.

Release sequence:

1. Review the exact pending migrations and record the current traffic, image
   digest and affected list IDs/statuses. Confirm a recoverable database
   backup. The cancellation migration reopens existing PAID/CANCELLED fixed
   lists; it is not purely additive data-wise. Do not use broad schema sync.
2. Build the committed release and deploy without traffic, with the flag off.
   Verify the new revision, authenticated admin/portal reads and critical
   ordering flows. Do not treat these local tests as production approval.
3. Promote the compatible revision with the flag still off. Verify logs and
   critical flows, then record this exact image/revision as the new rollback
   target. Wait for requests on older revisions to drain before activation.
4. Create a second no-traffic revision of the same immutable image with
   `RELEASE_EXPANDED_ENUM_WRITES=true`. Validate it against the compatible
   rollback target, then promote only after the remaining release gates pass.
5. After activation, roll back only to the compatible revision from step 3.
   The pre-compatibility `2d130c8` revision is no longer a safe rollback target.
   Turning the flag off does not delete newly configured steps, cancel requests,
   or rewrite their history. It does not make old binaries understand new enums.

This flag addresses enum-reader compatibility, not every release risk. A mixed
old/new checkout can still apply different discount/list business rules. Do not
assume a percentage canary protects those writes; verify the routing/transition
plan separately before directing customer traffic to the new application.
