import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canManageCostOverview } from "../lib/cost-overview-auth";
import {
  buildCostInvoiceStorageKey,
  invoiceUploadLengthError,
  invoiceFileSizeError,
  validateCostInvoice,
  CostInvoiceValidationError,
} from "../lib/cost-invoice-storage";
import {
  costInvoiceDto,
  costMutationHash,
  managedCostDto,
  isPrismaUniqueConstraintError,
} from "../lib/cost-overview";
import {
  managedCostCreateSchema,
  managedCostUpdateSchema,
  parseListLimit,
} from "../lib/cost-overview-schema";

test("cost writes fail closed and require both OWNER and explicit developer allowlist", () => {
  const previous = process.env.COST_OVERVIEW_DEVELOPER_USERNAMES;
  try {
    delete process.env.COST_OVERVIEW_DEVELOPER_USERNAMES;
    assert.equal(
      canManageCostOverview({ role: "OWNER", username: "developer" }),
      false,
    );
    process.env.COST_OVERVIEW_DEVELOPER_USERNAMES =
      " Developer, another-owner ";
    assert.equal(
      canManageCostOverview({ role: "OWNER", username: "developer" }),
      true,
    );
    assert.equal(
      canManageCostOverview({ role: "ADMIN", username: "developer" }),
      false,
    );
    assert.equal(
      canManageCostOverview({ role: "OWNER", username: "not-listed" }),
      false,
    );
  } finally {
    if (previous === undefined)
      delete process.env.COST_OVERVIEW_DEVELOPER_USERNAMES;
    else process.env.COST_OVERVIEW_DEVELOPER_USERNAMES = previous;
  }
});

test("managed costs support an explicit unknown amount without inventing a price", () => {
  const input = managedCostCreateSchema.parse({
    provider: "PHOTOROOM",
    providerName: "PhotoRoom",
    category: "SOFTWARE",
    amountCents: null,
    recurrence: "MONTHLY",
  });
  assert.equal(input.amountCents, null);

  const dto = managedCostDto({
    id: "10000000-0000-4000-8000-000000000001",
    provider: "PHOTOROOM",
    providerName: "PhotoRoom",
    category: "SOFTWARE",
    description: null,
    amountCents: null,
    currency: "EUR",
    recurrence: "MONTHLY",
    startsAt: null,
    endsAt: null,
    active: true,
    version: 1,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
  });
  assert.equal(dto.amountStatus, "BEDRAG_NOG_VASTLEGGEN");
});

test("managed cost validation enforces optimistic versioning and bounded lists", () => {
  assert.equal(
    managedCostUpdateSchema.safeParse({ providerName: "New" }).success,
    false,
  );
  assert.equal(
    managedCostUpdateSchema.safeParse({
      expectedVersion: 2,
      providerName: "New",
    }).success,
    true,
  );
  assert.equal(parseListLimit("500"), 100);
  assert.equal(parseListLimit("bad"), 50);
});

test("idempotency hashes are canonical and bind the operation", () => {
  assert.equal(
    costMutationHash("CREATE", {
      provider: "PRISMA",
      amount: 100,
      nested: { b: 2, a: 1 },
    }),
    costMutationHash("CREATE", {
      nested: { a: 1, b: 2 },
      amount: 100,
      provider: "PRISMA",
    }),
  );
  assert.notEqual(
    costMutationHash("CREATE", { amount: 100 }),
    costMutationHash("UPDATE", { amount: 100 }),
  );
});

test("invoice upload requires a bounded content length and rejects MIME/signature mismatch", async () => {
  assert.equal(invoiceUploadLengthError(null), "CONTENT_LENGTH_REQUIRED");
  assert.equal(
    invoiceUploadLengthError("not-a-number"),
    "INVALID_CONTENT_LENGTH",
  );
  assert.equal(
    invoiceUploadLengthError(String(18 * 1024 * 1024)),
    "INVOICE_TOO_LARGE",
  );
  assert.equal(invoiceFileSizeError(0, "100"), "EMPTY_INVOICE");
  assert.equal(
    invoiceFileSizeError(16 * 1024 * 1024, String(17 * 1024 * 1024)),
    "INVOICE_TOO_LARGE",
  );
  assert.equal(invoiceFileSizeError(1000, "999"), "INVALID_CONTENT_LENGTH");
  assert.equal(invoiceFileSizeError(1000, "1200"), null);
  assert.match(
    buildCostInvoiceStorageKey("pdf"),
    /^admin\/cost-invoices\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/,
  );

  await assert.rejects(
    () => validateCostInvoice(Buffer.from("not a PDF"), "application/pdf"),
    (error: unknown) =>
      error instanceof CostInvoiceValidationError &&
      error.message === "INVALID_INVOICE_SIGNATURE",
  );
  await assert.rejects(
    () => validateCostInvoice(Buffer.from("<svg></svg>"), "image/svg+xml"),
    (error: unknown) =>
      error instanceof CostInvoiceValidationError &&
      error.message === "INVOICE_TYPE_NOT_ALLOWED",
  );
});

test("invoice upload checks sizes and idempotency before GCS", () => {
  const route = readFileSync(
    "app/api/admin/cost-overview/invoices/route.ts",
    "utf8",
  );
  assert.ok(
    route.indexOf("invoiceUploadLengthError") <
      route.indexOf("request.formData()"),
  );
  assert.ok(
    route.indexOf("invoiceFileSizeError(file.size") <
      route.indexOf("file.arrayBuffer()"),
  );
  assert.ok(
    route.indexOf("const replay = await preflightCostInvoiceMutation") <
      route.indexOf("await saveImmutableCostInvoice"),
  );
});

test("concurrent idempotency unique conflicts are recognized for replay recovery", () => {
  assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isPrismaUniqueConstraintError({ code: "P2025" }), false);
});

test("the additive migration enforces cost and invoice invariants in PostgreSQL", () => {
  const migration = readFileSync(
    "prisma/migrations/20260821120000_add_cost_overview/migration.sql",
    "utf8",
  );
  for (const constraint of [
    "ManagedCost_providerName_nonblank",
    "ManagedCost_amountCents_nonnegative",
    "ManagedCost_currency_iso",
    "ManagedCost_version_positive",
    "ManagedCost_date_order",
    "CostInvoice_originalFilename_nonblank",
    "CostInvoice_fileSize_positive",
    "CostInvoice_sha256_hex",
    "CostInvoice_billing_period_order",
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.match(migration, /'PHOTOROOM'[\s\S]+NULL[\s\S]+'PRISMA'[\s\S]+NULL/);
});

test("invoice DTO exposes secure download identity but never storage metadata", () => {
  const dto = costInvoiceDto({
    id: "20000000-0000-4000-8000-000000000001",
    managedCostId: null,
    provider: "PRISMA",
    category: "INFRASTRUCTURE",
    amountCents: 1200,
    currency: "EUR",
    issuedAt: new Date("2026-08-20T00:00:00.000Z"),
    billingPeriodStart: null,
    billingPeriodEnd: null,
    originalFilename: "invoice.pdf",
    contentType: "application/pdf",
    fileSize: 100,
    notes: null,
    version: 1,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
    managedCost: null,
  });
  assert.equal("storageKey" in dto, false);
  assert.equal("sha256" in dto, false);
  assert.equal(
    dto.downloadUrl,
    `/api/admin/cost-overview/invoices/${dto.id}/download`,
  );
});
