import { describe, it, expect } from "vitest";
import {
  ImportBatchSchema,
  ImportRowSchema,
  ImportRowStatusSchema,
  ImportMappingDtoSchema,
} from "./import.js";

const validBatch = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  fileName: "producten.csv",
  fileSize: 10240,
  sourceFormat: "csv",
  mappingConfig: null,
  dedupStrategy: "bySku",
  status: "uploaded" as const,
  totalRecords: null,
  validatedCount: 0,
  invalidCount: 0,
  importedCount: 0,
  failedCount: 0,
  startedBy: "550e8400-e29b-41d4-a716-446655440001",
  startedAt: new Date().toISOString(),
  validatedAt: null,
  completedAt: null,
  undoneAt: null,
};

const validRow = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  batchId: "550e8400-e29b-41d4-a716-446655440000",
  rowNumber: 1,
  rawData: { sku: "HAZ-001", name: "Hazelnoot" },
  parsedData: null,
  productId: null,
  status: "parsed" as const,
  errors: null,
  action: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ImportRowStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["parsed", "validated", "invalid", "imported", "failed", "skipped"] as const;
    for (const s of statuses) {
      expect(ImportRowStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects unknown status", () => {
    expect(() => ImportRowStatusSchema.parse("pending")).toThrow();
  });
});

describe("ImportBatchSchema", () => {
  it("accepts valid batch", () => {
    const result = ImportBatchSchema.parse(validBatch);
    expect(result.fileName).toBe("producten.csv");
  });

  it("rejects negative fileSize", () => {
    expect(() => ImportBatchSchema.parse({ ...validBatch, fileSize: -1 })).toThrow();
  });

  it("rejects unknown status", () => {
    expect(() => ImportBatchSchema.parse({ ...validBatch, status: "done" })).toThrow();
  });
});

describe("ImportRowSchema", () => {
  it("accepts valid row", () => {
    const result = ImportRowSchema.parse(validRow);
    expect(result.rowNumber).toBe(1);
  });

  it("rejects rowNumber of zero", () => {
    expect(() => ImportRowSchema.parse({ ...validRow, rowNumber: 0 })).toThrow();
  });
});

describe("ImportMappingDtoSchema", () => {
  it("accepts valid mapping", () => {
    const result = ImportMappingDtoSchema.parse({
      sourceColumn: "naam",
      targetField: "name",
    });
    expect(result.targetField).toBe("name");
  });

  it("accepts optional transform", () => {
    const result = ImportMappingDtoSchema.parse({
      sourceColumn: "prijs",
      targetField: "priceCents",
      transform: "eurosToCents",
    });
    expect(result.transform).toBe("eurosToCents");
  });

  it("rejects empty sourceColumn", () => {
    expect(() => ImportMappingDtoSchema.parse({ sourceColumn: "", targetField: "name" })).toThrow();
  });
});
