# Product image migration

This one-time migration treats every existing `ProductImage.storageKey` as a
read-only source. It never replaces that key and never writes outside a
run-specific `products/<productId>/derived/<version>/<imageId>/<runId>/` path.

## Runtime requirements

- Node.js 22 or newer (local verification also covers Node.js 24).
- Google Application Default Credentials with read access to original objects
  and create/delete access limited to the bucket's derived image namespace.
- PostgreSQL access through `DATABASE_URL`.
- `GCS_BUCKET` and `CDN_BASE_URL`.
- No system OpenCV, Python, CMake or Visual Studio installation is required.
  `@techstark/opencv-js` is an exact-pinned Apache-2.0 WebAssembly package and
  is used only by this local script. Sharp handles EXIF normalization, crops,
  resizing and WebP/AVIF encoding.

The configurable defaults live in
`lib/product-image-migration/config.ts`. Only these bounded overrides are
supported: `IMAGE_MIGRATION_MARGIN_RATIO`,
`IMAGE_MIGRATION_CONFIDENCE_THRESHOLD` and `IMAGE_MIGRATION_CONCURRENCY`.

## Safe execution

Generate Prisma Client, then run the read-only analysis before deploying the
expand-only ledger migration:

```powershell
npx.cmd prisma generate
npm.cmd run images:migrate -- --dry-run --limit=10 --report=output/product-image-migration/dry-run/report.json
```

Only after the dry-run report is accepted, deploy the schema:

```powershell
npx.cmd prisma migrate deploy
```

Run one explicitly selected product after reviewing the local JSON, CSV and
HTML reports:

```powershell
npm.cmd run images:migrate -- --apply --product-id=<product-id> --limit=10 --report=output/product-image-migration/trial/report.json
```

Resume a bounded run; successful records are skipped only when the source key
and GCS object generation still match:

```powershell
npm.cmd run images:migrate -- --apply --resume --limit=10
```

Run the complete remaining set only after the trial report is approved:

```powershell
npm.cmd run images:migrate -- --apply --resume
```

`--force` is accepted only with `--apply`. It writes a fresh run-specific set
of derived objects and never overwrites originals or earlier derived objects.
Old, unreferenced derived runs are intentionally retained; cleanup is a
separate operation and is not part of this migration.

Verify a completed run without changing database or storage state:

```powershell
npm.cmd run images:verify -- --run-id=<run-id>
```

## Running it in production (Cloud Run job)

`lib/database-access.cjs` refuses the production database to local tooling on
purpose, so the production catalogue is processed by a Cloud Run job instead of
a laptop. The job runs the same `scripts/migrate-product-images.ts`;
`scripts/ops/image-migration-job.ts` only validates configuration, gates
writes, reaches Postgres on its direct endpoint and persists the reports.

### Why it is safe to just run it again

Every succeeded image is skipped while its source key and GCS object
generation still match, and each success commits in its own transaction. A
cancelled, timed-out or retried task therefore loses no finished work and
continues where it stopped. Retries are configured (`--max-retries=3`) for
exactly that reason — there is no "resume from N" bookkeeping to get wrong.

### Deploying the job

```powershell
gcloud builds triggers run denotenman-image-migration-job --region=europe-west4 --sha=<40-char commit sha>
```

`cloudbuild-image-migration.yaml` builds `Dockerfile.image-migration`, pushes
it, and runs `gcloud run jobs deploy` (create-or-update, so re-running is
idempotent). `DEPLOYMENT_VERSION` is pinned to that commit, which is what
`lib/database-access.cjs` admits as a controlled release. The deployed
configuration is always `IMAGE_MIGRATION_JOB_MODE=dry-run`: deploying can
never start writing.

### Executing

A bare execution is a dry run over the whole catalogue — it decodes, detects
and encodes every image but uploads nothing and writes no ledger rows:

```powershell
gcloud run jobs execute denotenman-image-migration --region=europe-west4 --wait
```

Canary one product, then apply. The confirmation token names the processing
version, so a token copied from an older runbook cannot authorise a different
pipeline:

```powershell
gcloud run jobs execute denotenman-image-migration --region=europe-west4 --wait `
  --update-env-vars=IMAGE_MIGRATION_JOB_MODE=apply,IMAGE_MIGRATION_JOB_CONFIRM=APPLY-circle-center-v1,IMAGE_MIGRATION_JOB_PRODUCT_ID=<product-id>
```

```powershell
gcloud run jobs execute denotenman-image-migration --region=europe-west4 `
  --update-env-vars=IMAGE_MIGRATION_JOB_MODE=apply,IMAGE_MIGRATION_JOB_CONFIRM=APPLY-circle-center-v1
```

`--update-env-vars` on `execute` applies to that execution only, so the job's
stored configuration stays a dry run.

| Variable | Default | Meaning |
| --- | --- | --- |
| `IMAGE_MIGRATION_JOB_MODE` | `dry-run` | `dry-run` or `apply`. Anything else is rejected. |
| `IMAGE_MIGRATION_JOB_CONFIRM` | — | Required to apply: `APPLY-<processingVersion>`, or `FORCE-<processingVersion>` with force. |
| `IMAGE_MIGRATION_JOB_FORCE` | — | `true` reprocesses succeeded images. Needs `apply` and its own token. |
| `IMAGE_MIGRATION_JOB_LIMIT` | — | First N products by id. Use for a canary, not for paging: it is not a cursor. |
| `IMAGE_MIGRATION_JOB_PRODUCT_ID` | — | One product. |
| `IMAGE_MIGRATION_JOB_REPORT_PREFIX` | `ops/image-migration` | Must stay under `ops/`, so reports can never overwrite product objects. |

### Reports

Reports are uploaded even when the run exits non-zero, which is when they
matter most:

```
gs://notenbucket/ops/image-migration/<cloud-run-execution>/report.{json,csv,html}
```

### Then verify, and expect the storefront to pick it up

`npm run images:verify -- --run-id=<run-id>` (run id is in `report.json`)
re-reads storage and asserts originals are untouched. `ProductCard` reads
`cardUrl` from the newest succeeded record, so processed cards start serving
their variant within the storefront's 60-second revalidate window — no deploy
needed. `npm run images:scan -- --base=https://denotenman.com` confirms every
served URL still resolves.

### Beware: derived objects from before 2026-08-21 are orphans

The migration ran on 2026-08-20; `scripts/restore-catalog-from-manifest.ts`
re-created the catalogue the next day with new product ids, and
`ProductImageProcessing` cascades on image delete. The ~847 derived objects
under the old `cmsorj…` product ids therefore belong to products that no
longer exist, and no current image has a succeeded record. Coverage must be
judged from the ledger, not from object counts in the bucket.
