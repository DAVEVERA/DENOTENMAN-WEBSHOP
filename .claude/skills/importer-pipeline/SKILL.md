---
name: importer-pipeline
description: Use for any work on the product importer. Defines the upload → parse → map → validate → dry-run → commit flow, error reporting format, deduplication strategy, and undo mechanism. All importer features must follow this pipeline exactly.
---

## Pipeline stages

### 1. Upload

- Endpoint: `POST /v1/admin/imports` (multipart).
- Admin uploads CSV, XLSX, or JSON.
- File stored in R2 under `imports/<batchId>/source.<ext>`.
- `ImportBatch` row created: `status=uploaded`, `totalRecords=null`.

### 2. Parse

In worker:
- CSV → `papaparse` streaming.
- XLSX → `xlsx` library, first sheet.
- JSON → array of objects, top-level array required.

Headers normalized: trim, lowercase, spaces → underscores. Row count updates `ImportBatch.totalRecords`.

### 3. Map

- UI shows detected headers on left, Product schema fields on right.
- Auto-suggest using synonym dictionary (e.g. `prijs` → `priceCents`, `voorraad` → `stock`, `sku` → `sku`, `naam` → `name`).
- User saves mapping as a named template per source (reusable for future imports from the same supplier).
- Mapping stored in `ImportBatch.mappingConfig` JSON.

### 4. Validate (dry-run)

- Worker iterates rows.
- For each row: apply mapping → construct `ProductImportRowSchema.safeParse(input)`.
- Successful rows: written to `ImportRow` with `status=validated`, parsed data in `data` JSON column.
- Failed rows: `status=invalid`, `errors` = array of `{ path, message }`.
- Batch status → `validated` when done.
- UI shows: total / validated / invalid counts, downloadable error CSV with row number + column + message.

### 5. Dedup strategy (user-selected)

Options saved on the batch:
- `bySku` (default) — match existing `Product` by SKU.
- `bySlug` — match by slug.
- `byNameVariant` — match by (name + variant-weight).

For each matched row, user picks per-row or batch-wide: `skip`, `overwrite`, `create-new-with-suffix`.

### 6. Commit

- Endpoint: `POST /v1/admin/imports/:id/commit`.
- Worker processes each `ImportRow` in its own Prisma `$transaction`:
  1. Resolve category by slug (create if missing, per a flag on the batch).
  2. Upsert Product based on dedup strategy.
  3. Upsert ProductVariant rows.
  4. Upsert ProductImage rows (images downloaded from URLs in background, variant rows can reference image ids).
  5. Write `AuditLog` snapshot with `before` and `after` Product state.
  6. Set `ImportRow.status = imported`.
- One row failure does not abort the batch. Failed rows → `status=failed` with reason.
- `ImportBatch.status = completed` when all rows processed.
- Progress emitted via WebSocket or SSE: `{ processed, total, failed }` every 1s or every 50 rows, whichever comes first.

### 7. Undo

- Endpoint: `POST /v1/admin/imports/:id/undo`.
- Available for 24 hours after `completedAt`.
- Reads AuditLog `before` snapshots and reverts each affected product.
- Creates a new AuditLog entry marking the undo.

## Schemas (in `packages/schemas/import.ts`)

```ts
export const ProductImportRowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categorySlug: z.string().regex(/^[a-z0-9-/]+$/),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  weightGrams: z.number().int().positive(),
  origin: z.string().optional(),
  harvestYear: z.number().int().min(2000).max(2100).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
});
export type ProductImportRow = z.infer<typeof ProductImportRowSchema>;
```

## UI rules (apps/admin/import)

- Stepper: Upload → Map → Validate → Dedup → Commit. Each step is a route, shareable URL.
- Grid of invalid rows is keyboard-navigable: arrow keys move, Enter edits cell, Cmd+S saves that row's fix (triggers re-validation of just that row).
- Commit button is disabled until zero invalid rows OR user explicitly chooses "skip invalid".
- Destructive confirmation on overwrite: type the number of products that will change.

## Performance budget

- 1,000-row XLSX: validate in ≤ 10s, commit in ≤ 30s on a dev laptop.
- Memory: streaming parse, never hold the whole file in memory past the parse stage.
