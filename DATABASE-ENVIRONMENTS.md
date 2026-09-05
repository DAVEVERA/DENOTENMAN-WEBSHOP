# Database environments

The existing Neon database is reserved for production:

- Host: `ep-small-pond-b2su7ww7.c-6.eu-central-1.aws.neon.tech` (including its pooled endpoint).
- Database: `neondb`.
- Service: `denotenman-webshop`, project `project-5dc79156-4200-4528-bfc`, region `europe-west4`.
- Credential source for production: Secret Manager `denotenman-database-url`.

Local development must use a separate `DATABASE_URL`. There is currently no
separate development target configured. Do not use the production URL to make
local startup or tests pass. The production URL has been removed from the local
`.env`; the production secret itself has not been rotated or modified.

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
