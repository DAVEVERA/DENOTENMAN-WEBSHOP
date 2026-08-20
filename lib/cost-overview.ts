import { createHash } from "node:crypto";
import {
  Prisma,
  type AdminUser,
  type CostCategory,
  type CostProvider,
  type CostRecurrence,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/admin-audit";
import type {
  InvoiceMetadataInput,
  ManagedCostCreateInput,
  ManagedCostUpdateInput,
} from "@/lib/cost-overview-schema";

export class CostOverviewError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export type ManagedCostDto = {
  id: string;
  provider: CostProvider;
  providerName: string;
  category: CostCategory;
  description: string | null;
  amountCents: number | null;
  amountStatus: "VASTGELEGD" | "BEDRAG_NOG_VASTLEGGEN";
  currency: string;
  recurrence: CostRecurrence;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CostInvoiceDto = {
  id: string;
  managedCostId: string | null;
  provider: CostProvider | null;
  providerName: string | null;
  category: CostCategory | null;
  amountCents: number | null;
  currency: string;
  issuedAt: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};

type ManagedCostRecord = {
  id: string;
  provider: CostProvider;
  providerName: string;
  category: CostCategory;
  description: string | null;
  amountCents: number | null;
  currency: string;
  recurrence: CostRecurrence;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type CostInvoiceRecord = {
  id: string;
  managedCostId: string | null;
  provider: CostProvider | null;
  category: CostCategory | null;
  amountCents: number | null;
  currency: string;
  issuedAt: Date;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  managedCost: { providerName: string } | null;
};

export function managedCostDto(cost: ManagedCostRecord): ManagedCostDto {
  return {
    id: cost.id,
    provider: cost.provider,
    providerName: cost.providerName,
    category: cost.category,
    description: cost.description,
    amountCents: cost.amountCents,
    amountStatus:
      cost.amountCents === null ? "BEDRAG_NOG_VASTLEGGEN" : "VASTGELEGD",
    currency: cost.currency,
    recurrence: cost.recurrence,
    startsAt: cost.startsAt?.toISOString() ?? null,
    endsAt: cost.endsAt?.toISOString() ?? null,
    active: cost.active,
    version: cost.version,
    createdAt: cost.createdAt.toISOString(),
    updatedAt: cost.updatedAt.toISOString(),
  };
}

export function costInvoiceDto(invoice: CostInvoiceRecord): CostInvoiceDto {
  return {
    id: invoice.id,
    managedCostId: invoice.managedCostId,
    provider: invoice.provider,
    providerName: invoice.managedCost?.providerName ?? null,
    category: invoice.category,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    issuedAt: invoice.issuedAt.toISOString(),
    billingPeriodStart: invoice.billingPeriodStart?.toISOString() ?? null,
    billingPeriodEnd: invoice.billingPeriodEnd?.toISOString() ?? null,
    originalFilename: invoice.originalFilename,
    contentType: invoice.contentType,
    fileSize: invoice.fileSize,
    notes: invoice.notes,
    version: invoice.version,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    downloadUrl: `/api/admin/cost-overview/invoices/${invoice.id}/download`,
  };
}

export async function listManagedCosts(
  limit: number,
): Promise<ManagedCostDto[]> {
  const costs = await prisma.managedCost.findMany({
    where: { deletedAt: null },
    orderBy: [{ active: "desc" }, { providerName: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
  return costs.map(managedCostDto);
}

export async function listCostInvoices(
  limit: number,
): Promise<CostInvoiceDto[]> {
  const invoices = await prisma.costInvoice.findMany({
    where: { deletedAt: null },
    include: { managedCost: { select: { providerName: true } } },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
  return invoices.map(costInvoiceDto);
}

export function costMutationHash(operation: string, payload: unknown): string {
  return createHash("sha256")
    .update(`${operation}\n${stableJson(payload)}`)
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function replay<T>(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
): Promise<T | null> {
  const previous = await tx.costMutation.findUnique({
    where: { adminUserId_idempotencyKey: { adminUserId, idempotencyKey } },
  });
  if (!previous) return null;
  if (
    previous.operation !== operation ||
    previous.requestHash !== requestHash
  ) {
    throw new CostOverviewError("IDEMPOTENCY_KEY_REUSED", 409);
  }
  return previous.response as T;
}

async function saveMutation(
  tx: Prisma.TransactionClient,
  input: {
    adminUserId: string;
    idempotencyKey: string;
    operation: string;
    requestHash: string;
    entityType: string;
    entityId: string;
    response: object;
  },
) {
  await tx.costMutation.create({
    data: { ...input, response: input.response as Prisma.InputJsonValue },
  });
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code === "P2002"
    : Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002",
      );
}

async function recoverConcurrentReplay<T>(
  error: unknown,
  adminUserId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
): Promise<T | null> {
  if (!isPrismaUniqueConstraintError(error)) return null;
  const previous = await prisma.costMutation.findUnique({
    where: { adminUserId_idempotencyKey: { adminUserId, idempotencyKey } },
  });
  if (!previous) return null;
  if (
    previous.operation !== operation ||
    previous.requestHash !== requestHash
  ) {
    throw new CostOverviewError("IDEMPOTENCY_KEY_REUSED", 409);
  }
  return previous.response as T;
}

export async function createManagedCost(
  admin: AdminUser,
  idempotencyKey: string,
  input: ManagedCostCreateInput,
): Promise<{ cost: ManagedCostDto; replayed: boolean }> {
  const operation = "CREATE_MANAGED_COST";
  const requestHash = costMutationHash(operation, input);
  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await replay<ManagedCostDto>(
        tx,
        admin.id,
        idempotencyKey,
        operation,
        requestHash,
      );
      if (previous) return { cost: previous, replayed: true };
      const cost = await tx.managedCost.create({
        data: {
          ...input,
          description: input.description || null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          createdByAdminUserId: admin.id,
          updatedByAdminUserId: admin.id,
        },
      });
      const dto = managedCostDto(cost);
      await recordAudit(tx, admin, "ManagedCost", cost.id, "CREATE", null, dto);
      await saveMutation(tx, {
        adminUserId: admin.id,
        idempotencyKey,
        operation,
        requestHash,
        entityType: "ManagedCost",
        entityId: cost.id,
        response: dto,
      });
      return { cost: dto, replayed: false };
    });
  } catch (error) {
    const previous = await recoverConcurrentReplay<ManagedCostDto>(
      error,
      admin.id,
      idempotencyKey,
      operation,
      requestHash,
    );
    if (previous) return { cost: previous, replayed: true };
    throw error;
  }
}

export async function updateManagedCost(
  id: string,
  admin: AdminUser,
  idempotencyKey: string,
  input: ManagedCostUpdateInput,
): Promise<{ cost: ManagedCostDto; replayed: boolean }> {
  const operation = "UPDATE_MANAGED_COST";
  const requestHash = costMutationHash(operation, { id, ...input });
  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await replay<ManagedCostDto>(
        tx,
        admin.id,
        idempotencyKey,
        operation,
        requestHash,
      );
      if (previous) return { cost: previous, replayed: true };
      const current = await tx.managedCost.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) throw new CostOverviewError("NOT_FOUND", 404);
      const { expectedVersion, ...changes } = input;
      const effectiveStartsAt =
        changes.startsAt === undefined ? current.startsAt : changes.startsAt;
      const effectiveEndsAt =
        changes.endsAt === undefined ? current.endsAt : changes.endsAt;
      if (
        effectiveStartsAt &&
        effectiveEndsAt &&
        effectiveEndsAt < effectiveStartsAt
      ) {
        throw new CostOverviewError("ENDS_BEFORE_START", 400);
      }
      const { count } = await tx.managedCost.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          ...changes,
          description: changes.description === "" ? null : changes.description,
          version: { increment: 1 },
          updatedByAdminUserId: admin.id,
        },
      });
      if (count !== 1) throw new CostOverviewError("STALE_VERSION", 409);
      const updated = await tx.managedCost.findUniqueOrThrow({ where: { id } });
      const before = managedCostDto(current);
      const dto = managedCostDto(updated);
      await recordAudit(tx, admin, "ManagedCost", id, "UPDATE", before, dto);
      await saveMutation(tx, {
        adminUserId: admin.id,
        idempotencyKey,
        operation,
        requestHash,
        entityType: "ManagedCost",
        entityId: id,
        response: dto,
      });
      return { cost: dto, replayed: false };
    });
  } catch (error) {
    const previous = await recoverConcurrentReplay<ManagedCostDto>(
      error,
      admin.id,
      idempotencyKey,
      operation,
      requestHash,
    );
    if (previous) return { cost: previous, replayed: true };
    throw error;
  }
}

export async function softDeleteManagedCost(
  id: string,
  admin: AdminUser,
  idempotencyKey: string,
  expectedVersion: number,
): Promise<{ cost: ManagedCostDto; replayed: boolean }> {
  const operation = "DELETE_MANAGED_COST";
  const requestHash = costMutationHash(operation, { id, expectedVersion });
  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await replay<ManagedCostDto>(
        tx,
        admin.id,
        idempotencyKey,
        operation,
        requestHash,
      );
      if (previous) return { cost: previous, replayed: true };
      const current = await tx.managedCost.findFirst({
        where: { id, deletedAt: null },
      });
      if (!current) throw new CostOverviewError("NOT_FOUND", 404);
      const deletedAt = new Date();
      const { count } = await tx.managedCost.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          deletedAt,
          deletedByAdminUserId: admin.id,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw new CostOverviewError("STALE_VERSION", 409);
      const updated = await tx.managedCost.findUniqueOrThrow({ where: { id } });
      const before = managedCostDto(current);
      const dto = managedCostDto(updated);
      await recordAudit(tx, admin, "ManagedCost", id, "DELETE", before, dto);
      await saveMutation(tx, {
        adminUserId: admin.id,
        idempotencyKey,
        operation,
        requestHash,
        entityType: "ManagedCost",
        entityId: id,
        response: dto,
      });
      return { cost: dto, replayed: false };
    });
  } catch (error) {
    const previous = await recoverConcurrentReplay<ManagedCostDto>(
      error,
      admin.id,
      idempotencyKey,
      operation,
      requestHash,
    );
    if (previous) return { cost: previous, replayed: true };
    throw error;
  }
}

type CostInvoiceMutationPayload = {
  metadata: InvoiceMetadataInput;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  sha256: string;
};

export function costInvoiceMutationHash(
  payload: CostInvoiceMutationPayload,
): string {
  return costMutationHash("CREATE_COST_INVOICE", payload);
}

export async function preflightCostInvoiceMutation(
  adminUserId: string,
  idempotencyKey: string,
  payload: CostInvoiceMutationPayload,
): Promise<CostInvoiceDto | null> {
  const operation = "CREATE_COST_INVOICE";
  const requestHash = costInvoiceMutationHash(payload);
  const previous = await prisma.costMutation.findUnique({
    where: { adminUserId_idempotencyKey: { adminUserId, idempotencyKey } },
  });
  if (previous) {
    if (
      previous.operation !== operation ||
      previous.requestHash !== requestHash
    ) {
      throw new CostOverviewError("IDEMPOTENCY_KEY_REUSED", 409);
    }
    return previous.response as CostInvoiceDto;
  }
  if (payload.metadata.managedCostId) {
    const target = await prisma.managedCost.findFirst({
      where: { id: payload.metadata.managedCostId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new CostOverviewError("MANAGED_COST_NOT_FOUND", 404);
  }
  return null;
}

export async function createCostInvoiceRecord(input: {
  admin: AdminUser;
  idempotencyKey: string;
  metadata: InvoiceMetadataInput;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  sha256: string;
}): Promise<{ invoice: CostInvoiceDto; replayed: boolean }> {
  const operation = "CREATE_COST_INVOICE";
  const requestHash = costInvoiceMutationHash({
    metadata: input.metadata,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    fileSize: input.fileSize,
    sha256: input.sha256,
  });
  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await replay<CostInvoiceDto>(
        tx,
        input.admin.id,
        input.idempotencyKey,
        operation,
        requestHash,
      );
      if (previous) return { invoice: previous, replayed: true };
      const managedCost = input.metadata.managedCostId
        ? await tx.managedCost.findFirst({
            where: { id: input.metadata.managedCostId, deletedAt: null },
            select: { id: true, provider: true, category: true },
          })
        : null;
      if (input.metadata.managedCostId && !managedCost) {
        throw new CostOverviewError("MANAGED_COST_NOT_FOUND", 404);
      }
      const invoice = await tx.costInvoice.create({
        data: {
          managedCostId: managedCost?.id ?? null,
          provider: input.metadata.provider ?? managedCost?.provider ?? null,
          category: input.metadata.category ?? managedCost?.category ?? null,
          amountCents: input.metadata.amountCents,
          currency: input.metadata.currency,
          issuedAt: input.metadata.issuedAt,
          billingPeriodStart: input.metadata.billingPeriodStart,
          billingPeriodEnd: input.metadata.billingPeriodEnd,
          notes: input.metadata.notes || null,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          contentType: input.contentType,
          fileSize: input.fileSize,
          sha256: input.sha256,
          uploadedByAdminUserId: input.admin.id,
        },
        include: { managedCost: { select: { providerName: true } } },
      });
      const dto = costInvoiceDto(invoice);
      await recordAudit(
        tx,
        input.admin,
        "CostInvoice",
        invoice.id,
        "CREATE",
        null,
        dto,
      );
      await saveMutation(tx, {
        adminUserId: input.admin.id,
        idempotencyKey: input.idempotencyKey,
        operation,
        requestHash,
        entityType: "CostInvoice",
        entityId: invoice.id,
        response: dto,
      });
      return { invoice: dto, replayed: false };
    });
  } catch (error) {
    const previous = await recoverConcurrentReplay<CostInvoiceDto>(
      error,
      input.admin.id,
      input.idempotencyKey,
      operation,
      requestHash,
    );
    if (previous) return { invoice: previous, replayed: true };
    throw error;
  }
}

export async function softDeleteCostInvoice(
  id: string,
  admin: AdminUser,
  idempotencyKey: string,
  expectedVersion: number,
): Promise<{ invoice: CostInvoiceDto; replayed: boolean }> {
  const operation = "DELETE_COST_INVOICE";
  const requestHash = costMutationHash(operation, { id, expectedVersion });
  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await replay<CostInvoiceDto>(
        tx,
        admin.id,
        idempotencyKey,
        operation,
        requestHash,
      );
      if (previous) return { invoice: previous, replayed: true };
      const current = await tx.costInvoice.findFirst({
        where: { id, deletedAt: null },
        include: { managedCost: { select: { providerName: true } } },
      });
      if (!current) throw new CostOverviewError("NOT_FOUND", 404);
      const { count } = await tx.costInvoice.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          deletedAt: new Date(),
          deletedByAdminUserId: admin.id,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw new CostOverviewError("STALE_VERSION", 409);
      const updated = await tx.costInvoice.findUniqueOrThrow({
        where: { id },
        include: { managedCost: { select: { providerName: true } } },
      });
      const before = costInvoiceDto(current);
      const dto = costInvoiceDto(updated);
      await recordAudit(tx, admin, "CostInvoice", id, "DELETE", before, dto);
      await saveMutation(tx, {
        adminUserId: admin.id,
        idempotencyKey,
        operation,
        requestHash,
        entityType: "CostInvoice",
        entityId: id,
        response: dto,
      });
      return { invoice: dto, replayed: false };
    });
  } catch (error) {
    const previous = await recoverConcurrentReplay<CostInvoiceDto>(
      error,
      admin.id,
      idempotencyKey,
      operation,
      requestHash,
    );
    if (previous) return { invoice: previous, replayed: true };
    throw error;
  }
}

export async function getCostInvoiceDownload(id: string) {
  const invoice = await prisma.costInvoice.findFirst({
    where: { id, deletedAt: null },
    select: {
      storageKey: true,
      originalFilename: true,
      contentType: true,
      fileSize: true,
    },
  });
  if (!invoice) throw new CostOverviewError("NOT_FOUND", 404);
  return invoice;
}

export function safeOriginalFilename(
  value: string,
  contentType: string,
): string {
  const fallback =
    contentType === "application/pdf" ? "factuur.pdf" : "factuur-afbeelding";
  const cleaned = value
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}
