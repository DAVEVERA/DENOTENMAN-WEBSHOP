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
