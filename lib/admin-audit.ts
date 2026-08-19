import { prisma } from "@/lib/prisma";
import type { AdminUser, AuditAction, Prisma } from "@prisma/client";

export async function recordAudit(
  tx: Prisma.TransactionClient,
  admin: AdminUser,
  entityType: string,
  entityId: string,
  action: AuditAction,
  before: unknown,
  after: unknown,
  revertOfId?: string
): Promise<void> {
  await tx.auditLog.create({
    data: {
      adminUserId: admin.id,
      entityType,
      entityId,
      action,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
      revertOfId,
    },
  });
}

export type RevertResult = { ok: true } | { ok: false; error: string };

// Reverts a single AuditLog entry by replaying its `before` snapshot (for
// UPDATE/DELETE) or deleting the entity it created (for CREATE), then logs
// the revert itself as a new RESTORE entry so history stays append-only.
export async function revertAuditEntry(admin: AdminUser, auditLogId: string): Promise<RevertResult> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.auditLog.findUnique({ where: { id: auditLogId } });
    if (!entry) return { ok: false, error: "NOT_FOUND" };
    if (entry.reverted) return { ok: false, error: "ALREADY_REVERTED" };

    const model = getDelegate(tx, entry.entityType);
    if (!model) return { ok: false, error: "UNSUPPORTED_ENTITY_TYPE" };

    if (entry.action === "CREATE") {
      await model.delete({ where: { id: entry.entityId } });
    } else if (entry.action === "DELETE") {
      if (!entry.before) return { ok: false, error: "MISSING_SNAPSHOT" };
      await model.create({ data: entry.before as object });
    } else {
      if (!entry.before) return { ok: false, error: "MISSING_SNAPSHOT" };
      await model.update({ where: { id: entry.entityId }, data: entry.before as object });
    }

    await tx.auditLog.update({ where: { id: entry.id }, data: { reverted: true } });
    await recordAudit(
      tx,
      admin,
      entry.entityType,
      entry.entityId,
      "RESTORE",
      entry.after,
      entry.before,
      entry.id
    );

    return { ok: true };
  });
}

// entityType is the Prisma model name as stored on the AuditLog row (e.g.
// "Product", "QrCodeDesign") — this maps that string back to its delegate.
const AUDITABLE_MODELS = [
  "Product",
  "ProductVariant",
  "Category",
  "QrCodeDesign",
  "Discount",
  "MarketingBanner",
  "MarketingCampaign",
  "NewsletterCampaign",
  "BusinessAccount",
  "Quote",
] as const;

export function canRevertAuditEntity(entityType: string): boolean {
  return (AUDITABLE_MODELS as readonly string[]).includes(entityType);
}

type AuditableDelegate = {
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  create: (args: { data: object }) => Promise<unknown>;
  update: (args: { where: { id: string }; data: object }) => Promise<unknown>;
};

function getDelegate(tx: Prisma.TransactionClient, entityType: string): AuditableDelegate | null {
  if (!canRevertAuditEntity(entityType)) return null;
  const key = (entityType.charAt(0).toLowerCase() + entityType.slice(1)) as keyof Prisma.TransactionClient;
  return tx[key] as unknown as AuditableDelegate;
}
