import { createHash } from "node:crypto";
import { Prisma, type AdminUser, type ProductFaqPlacement, type ProductFaqStatus } from "@prisma/client";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  FAQ_MAX_ITEMS,
  hasPublishableFaqTranslation,
  normalizeFaqTranslations,
  type FaqCreateInput,
  type FaqDraftInput,
} from "@/lib/product-faq-schema";

export class ProductFaqError extends Error {
  constructor(
    public readonly code:
      | "PRODUCT_NOT_FOUND"
      | "FAQ_NOT_FOUND"
      | "STALE_FAQ_SET"
      | "STALE_FAQ_ITEM"
      | "FAQ_LIMIT_REACHED"
      | "FAQ_NOT_PUBLISHABLE"
      | "INVALID_REORDER"
      | "IDEMPOTENCY_CONFLICT",
  ) {
    super(code);
  }
}

const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildFaqMutationRequestHash(
  operation: string,
  targetItemId: string | null,
  payload: unknown,
): string {
  return createHash("sha256")
    .update(stableJson({ operation, targetItemId, payload }))
    .digest("hex");
}

export function assertFaqMutationMatch(
  previous: { operation: string; requestHash: string; itemId: string | null },
  operation: string,
  requestHash: string,
  targetItemId?: string,
): void {
  if (
    previous.operation !== operation
    || previous.requestHash !== requestHash
    || (targetItemId !== undefined && previous.itemId !== targetItemId)
  ) throw new ProductFaqError("IDEMPOTENCY_CONFLICT");
}

async function lockProduct(tx: Prisma.TransactionClient, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${productId}, 0))`;
}

async function getOrCreateSet(tx: Prisma.TransactionClient, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new ProductFaqError("PRODUCT_NOT_FOUND");
  return tx.productFaqSet.upsert({
    where: { productId },
    update: {},
    create: { productId },
  });
}

async function beginMutation(
  tx: Prisma.TransactionClient,
  productId: string,
  expectedRevision: number,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  targetItemId?: string,
) {
  await lockProduct(tx, productId);
  const set = await getOrCreateSet(tx, productId);
  const previous = await tx.productFaqMutation.findUnique({
    where: { faqSetId_idempotencyKey: { faqSetId: set.id, idempotencyKey } },
  });
  if (previous) {
    assertFaqMutationMatch(previous, operation, requestHash, targetItemId);
    return { set, previous };
  }
  if (set.aggregateRevision !== expectedRevision) throw new ProductFaqError("STALE_FAQ_SET");
  return { set, previous: null };
}

async function finishMutation(
  tx: Prisma.TransactionClient,
  setId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  itemId?: string,
) {
  await tx.productFaqMutation.create({ data: { faqSetId: setId, idempotencyKey, operation, requestHash, itemId } });
  await tx.productFaqSet.update({
    where: { id: setId },
    data: { aggregateRevision: { increment: 1 } },
  });
}

async function requireItem(
  tx: Prisma.TransactionClient,
  setId: string,
  itemId: string,
  itemVersion: number,
) {
  const item = await tx.productFaqItem.findFirst({
    where: { id: itemId, faqSetId: setId, deletedAt: null },
    include: {
      draftRevision: { include: { translations: true, mediaAsset: true } },
      publishedRevision: { include: { translations: true, mediaAsset: true } },
    },
  });
  if (!item) throw new ProductFaqError("FAQ_NOT_FOUND");
  if (item.version !== itemVersion) throw new ProductFaqError("STALE_FAQ_ITEM");
  return item;
}

export async function createFaqItem(productId: string, admin: AdminUser, input: FaqCreateInput) {
  const requestHash = buildFaqMutationRequestHash("CREATE", null, {
    expectedRevision: input.expectedRevision,
    placement: input.placement,
    translations: input.translations,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "CREATE", requestHash);
    if (previous?.itemId) return previous.itemId;
    if (await tx.productFaqItem.count({ where: { faqSetId: set.id, deletedAt: null } }) >= FAQ_MAX_ITEMS) {
      throw new ProductFaqError("FAQ_LIMIT_REACHED");
    }
    const sort = await tx.productFaqItem.aggregate({ where: { faqSetId: set.id, deletedAt: null }, _max: { sortOrder: true } });
    const item = await tx.productFaqItem.create({
      data: { faqSetId: set.id, placement: input.placement, sortOrder: (sort._max.sortOrder ?? -1) + 1 },
    });
    const translations = normalizeFaqTranslations(input.translations);
    const draft = await tx.productFaqRevision.create({
      data: {
        itemId: item.id,
        revision: 1,
        createdById: admin.id,
        translations: { create: translations },
      },
    });
    await tx.productFaqItem.update({ where: { id: item.id }, data: { draftRevisionId: draft.id, version: 1 } });
    await finishMutation(tx, set.id, input.idempotencyKey, "CREATE", requestHash, item.id);
    await recordAudit(tx, admin, "ProductFaqItem", item.id, "CREATE", null, { productId, placement: input.placement });
    return item.id;
  }, transactionOptions);
}

export async function saveFaqDraft(productId: string, itemId: string, admin: AdminUser, input: FaqDraftInput) {
  const requestHash = buildFaqMutationRequestHash("SAVE_DRAFT", itemId, {
    expectedRevision: input.expectedRevision,
    itemVersion: input.itemVersion,
    placement: input.placement,
    translations: input.translations,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "SAVE_DRAFT", requestHash, itemId);
    if (previous) return itemId;
    const item = await requireItem(tx, set.id, itemId, input.itemVersion);
    const translations = normalizeFaqTranslations(input.translations);
    const draft = await tx.productFaqRevision.create({
      data: {
        itemId,
        revision: item.version + 1,
        mediaAssetId: item.draftRevision?.mediaAssetId,
        createdById: admin.id,
        translations: { create: translations },
      },
    });
    await tx.productFaqItem.update({
      where: { id: itemId },
      data: { draftRevisionId: draft.id, placement: input.placement, version: { increment: 1 } },
    });
    await finishMutation(tx, set.id, input.idempotencyKey, "SAVE_DRAFT", requestHash, itemId);
    await recordAudit(tx, admin, "ProductFaqItem", itemId, "UPDATE", { version: item.version }, { version: item.version + 1, placement: input.placement });
    return itemId;
  }, transactionOptions);
}

export async function changeFaqStatus(
  productId: string,
  itemId: string,
  admin: AdminUser,
  input: { expectedRevision: number; itemVersion: number; idempotencyKey: string },
  status: ProductFaqStatus,
) {
  const operation = status === "PUBLISHED" ? "PUBLISH" : status === "HIDDEN" ? "HIDE" : "UNPUBLISH";
  const requestHash = buildFaqMutationRequestHash(operation, itemId, {
    expectedRevision: input.expectedRevision,
    itemVersion: input.itemVersion,
    status,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, operation, requestHash, itemId);
    if (previous) return itemId;
    const item = await requireItem(tx, set.id, itemId, input.itemVersion);
    if (status === "PUBLISHED") {
      if (!item.draftRevision || !hasPublishableFaqTranslation(item.draftRevision.translations)) {
        throw new ProductFaqError("FAQ_NOT_PUBLISHABLE");
      }
      if (item.draftRevision.mediaAsset && item.draftRevision.translations.some((translation) => !translation.mediaLabel?.trim())) {
        throw new ProductFaqError("FAQ_NOT_PUBLISHABLE");
      }
    }
    await tx.productFaqItem.update({
      where: { id: itemId },
      data: {
        status,
        publishedRevisionId: status === "PUBLISHED" ? item.draftRevisionId : item.publishedRevisionId,
        version: { increment: 1 },
      },
    });
    await finishMutation(tx, set.id, input.idempotencyKey, operation, requestHash, itemId);
    await recordAudit(tx, admin, "ProductFaqItem", itemId, "UPDATE", { status: item.status }, { status });
    return itemId;
  }, transactionOptions);
}

export async function deleteFaqItem(
  productId: string,
  itemId: string,
  admin: AdminUser,
  input: { expectedRevision: number; itemVersion: number; idempotencyKey: string },
) {
  const requestHash = buildFaqMutationRequestHash("DELETE", itemId, {
    expectedRevision: input.expectedRevision,
    itemVersion: input.itemVersion,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "DELETE", requestHash, itemId);
    if (previous) return itemId;
    const item = await requireItem(tx, set.id, itemId, input.itemVersion);
    await tx.productFaqItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date(), status: "HIDDEN", version: { increment: 1 } },
    });
    await finishMutation(tx, set.id, input.idempotencyKey, "DELETE", requestHash, itemId);
    await recordAudit(tx, admin, "ProductFaqItem", itemId, "DELETE", { status: item.status, placement: item.placement }, null);
    return itemId;
  }, transactionOptions);
}

export async function reorderFaqItems(
  productId: string,
  admin: AdminUser,
  input: { expectedRevision: number; idempotencyKey: string; itemIds: string[] },
) {
  const requestHash = buildFaqMutationRequestHash("REORDER", null, {
    expectedRevision: input.expectedRevision,
    itemIds: input.itemIds,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "REORDER", requestHash);
    if (previous) return;
    const current = await tx.productFaqItem.findMany({ where: { faqSetId: set.id, deletedAt: null }, select: { id: true, sortOrder: true } });
    if (current.length !== input.itemIds.length || current.some((item) => !input.itemIds.includes(item.id))) {
      throw new ProductFaqError("INVALID_REORDER");
    }
    for (const [sortOrder, id] of input.itemIds.entries()) {
      await tx.productFaqItem.update({ where: { id }, data: { sortOrder, version: { increment: 1 } } });
    }
    await finishMutation(tx, set.id, input.idempotencyKey, "REORDER", requestHash);
    await recordAudit(tx, admin, "ProductFaqSet", set.id, "UPDATE", current, input.itemIds);
  }, transactionOptions);
}

export async function attachFaqMedia(
  productId: string,
  itemId: string,
  admin: AdminUser,
  input: {
    expectedRevision: number;
    itemVersion: number;
    idempotencyKey: string;
    type: "IMAGE" | "INFOGRAPHIC" | "INSTRUCTION";
    storageKey: string;
    originalFilename: string;
    contentType: string;
    fileSize: number;
    width?: number;
    height?: number;
    pageCount?: number;
    durationMs?: number;
    requestHash: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "ATTACH_MEDIA", input.requestHash, itemId);
    if (previous) return { replayed: true } as const;
    const item = await requireItem(tx, set.id, itemId, input.itemVersion);
    if (!item.draftRevision) throw new ProductFaqError("FAQ_NOT_FOUND");
    const asset = await tx.productFaqMediaAsset.create({ data: { productId, type: input.type, storageKey: input.storageKey, originalFilename: input.originalFilename, contentType: input.contentType, fileSize: input.fileSize, width: input.width, height: input.height, pageCount: input.pageCount, durationMs: input.durationMs } });
    const draft = await tx.productFaqRevision.create({
      data: {
        itemId,
        revision: item.version + 1,
        mediaAssetId: asset.id,
        createdById: admin.id,
        translations: { create: item.draftRevision.translations.map(({ locale, question, answerHtml, mediaLabel }) => ({ locale, question, answerHtml, mediaLabel })) },
      },
    });
    await tx.productFaqItem.update({ where: { id: itemId }, data: { draftRevisionId: draft.id, version: { increment: 1 } } });
    await finishMutation(tx, set.id, input.idempotencyKey, "ATTACH_MEDIA", input.requestHash, itemId);
    await recordAudit(tx, admin, "ProductFaqMediaAsset", asset.id, "CREATE", null, { productId, itemId, type: input.type, contentType: input.contentType, fileSize: input.fileSize });
    return { replayed: false } as const;
  }, transactionOptions);
}

export async function isFaqMutationReplay(
  productId: string,
  itemId: string,
  idempotencyKey: string,
  operation: string,
  requestHash: string,
): Promise<boolean> {
  const set = await prisma.productFaqSet.findUnique({ where: { productId }, select: { id: true } });
  if (!set) return false;
  const previous = await prisma.productFaqMutation.findUnique({
    where: { faqSetId_idempotencyKey: { faqSetId: set.id, idempotencyKey } },
  });
  if (!previous) return false;
  assertFaqMutationMatch(previous, operation, requestHash, itemId);
  return true;
}

/**
 * Reject stale and cross-product media targets before any storage write. The
 * transaction repeats these checks under the product advisory lock.
 */
export async function validateFaqMediaMutationTarget(
  productId: string,
  itemId: string,
  expectedRevision: number,
  itemVersion: number,
): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new ProductFaqError("PRODUCT_NOT_FOUND");
  const set = await prisma.productFaqSet.findUnique({ where: { productId }, select: { id: true, aggregateRevision: true } });
  if (!set) throw new ProductFaqError("FAQ_NOT_FOUND");
  if (set.aggregateRevision !== expectedRevision) throw new ProductFaqError("STALE_FAQ_SET");
  const item = await prisma.productFaqItem.findFirst({
    where: { id: itemId, faqSetId: set.id, deletedAt: null },
    select: { version: true, draftRevisionId: true },
  });
  if (!item?.draftRevisionId) throw new ProductFaqError("FAQ_NOT_FOUND");
  if (item.version !== itemVersion) throw new ProductFaqError("STALE_FAQ_ITEM");
}

export async function detachFaqMedia(
  productId: string,
  itemId: string,
  admin: AdminUser,
  input: { expectedRevision: number; itemVersion: number; idempotencyKey: string },
) {
  const requestHash = buildFaqMutationRequestHash("DETACH_MEDIA", itemId, {
    expectedRevision: input.expectedRevision,
    itemVersion: input.itemVersion,
  });
  return prisma.$transaction(async (tx) => {
    const { set, previous } = await beginMutation(tx, productId, input.expectedRevision, input.idempotencyKey, "DETACH_MEDIA", requestHash, itemId);
    if (previous) return;
    const item = await requireItem(tx, set.id, itemId, input.itemVersion);
    if (!item.draftRevision) throw new ProductFaqError("FAQ_NOT_FOUND");
    const draft = await tx.productFaqRevision.create({ data: { itemId, revision: item.version + 1, createdById: admin.id, translations: { create: item.draftRevision.translations.map(({ locale, question, answerHtml, mediaLabel }) => ({ locale, question, answerHtml, mediaLabel })) } } });
    await tx.productFaqItem.update({ where: { id: itemId }, data: { draftRevisionId: draft.id, version: { increment: 1 } } });
    await finishMutation(tx, set.id, input.idempotencyKey, "DETACH_MEDIA", requestHash, itemId);
    await recordAudit(tx, admin, "ProductFaqItem", itemId, "UPDATE", { mediaAssetId: item.draftRevision.mediaAssetId }, { mediaAssetId: null });
  }, transactionOptions);
}

export type ProductFaqMutationPlacement = ProductFaqPlacement;
