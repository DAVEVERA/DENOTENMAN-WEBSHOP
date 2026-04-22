import { z } from "zod";
import { IdSchema } from "./common.js";

export const ImportStatusSchema = z.enum([
  "uploaded",
  "parsing",
  "validated",
  "committing",
  "completed",
  "failed",
]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const ImportRowStatusSchema = z.enum([
  "parsed",
  "validated",
  "invalid",
  "imported",
  "failed",
  "skipped",
]);
export type ImportRowStatus = z.infer<typeof ImportRowStatusSchema>;

export const ImportBatchSchema = z.object({
  id: IdSchema,
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  sourceFormat: z.string().min(1),
  mappingConfig: z.record(z.string()).nullable(),
  dedupStrategy: z.string().min(1),
  status: ImportStatusSchema,
  totalRecords: z.number().int().nonnegative().nullable(),
  validatedCount: z.number().int().nonnegative(),
  invalidCount: z.number().int().nonnegative(),
  importedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  startedBy: IdSchema,
  startedAt: z.coerce.date(),
  validatedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  undoneAt: z.coerce.date().nullable(),
});
export type ImportBatch = z.infer<typeof ImportBatchSchema>;

export const ImportRowSchema = z.object({
  id: IdSchema,
  batchId: IdSchema,
  rowNumber: z.number().int().positive(),
  rawData: z.record(z.unknown()),
  parsedData: z.record(z.unknown()).nullable(),
  productId: IdSchema.nullable(),
  status: ImportRowStatusSchema,
  errors: z.array(z.string()).nullable(),
  action: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

export const ImportMappingDtoSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.string().optional(),
});
export type ImportMappingDto = z.infer<typeof ImportMappingDtoSchema>;
