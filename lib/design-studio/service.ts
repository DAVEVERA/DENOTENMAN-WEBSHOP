import { randomUUID } from "node:crypto";
import { Prisma, type DesignProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteProductImage, publicImageUrl, saveProductImage } from "@/lib/storage";
import { loadProductImageBytes } from "@/lib/product-image-studio";
import { getOrderedProductImages, lockProductImages, productImageTransactionOptions } from "@/lib/product-image-studio-db";
import { revalidateProductImageStorefront } from "@/lib/product-image-revalidation";
import type { PhotoRoomJobInput } from "@/lib/design-studio/photoroom-schema";
import type { DesignAssetDto } from "@/lib/design-studio/types";
import { assertPhotoRoomAvailable, PhotoRoomError, runPhotoRoomEdit } from "@/lib/design-studio/photoroom-provider";

const PHOTOROOM_DAILY_LIMIT = 25;

export class DesignStudioError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "DesignStudioError";
  }
}

function amsterdamDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function safeDesignId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new DesignStudioError("INVALID_ID", "Ongeldige ontwerpidentiteit.", 422);
  return value;
}

export function designAssetDto(asset: {
  id: string; jobId: string; productId: string; sourceImageId: string; storageKey: string;
  width: number; height: number; fileSize: number; status: "DRAFT" | "PUBLISHED" | "DISCARDED";
  productImageId: string | null; createdAt: Date;
}): DesignAssetDto {
  return {
    id: asset.id,
    jobId: asset.jobId,
    productId: asset.productId,
    sourceImageId: asset.sourceImageId,
    url: publicImageUrl(asset.storageKey),
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    status: asset.status,
    productImageId: asset.productImageId,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function consumeDesignProviderAttempt(
  jobId: string,
  provider: DesignProvider,
  dailyLimit: number,
  providerLabel: string,
): Promise<number> {
  const dayKey = amsterdamDayKey();
  return prisma.$transaction(async (tx) => {
    await tx.designProviderUsage.upsert({
      where: { dayKey_provider: { dayKey, provider } },
      create: { dayKey, provider, attempts: 0 },
      update: {},
    });
    const incremented = await tx.designProviderUsage.updateMany({
      where: { dayKey, provider, attempts: { lt: dailyLimit } },
      data: { attempts: { increment: 1 } },
    });
    if (incremented.count !== 1) throw new DesignStudioError("DAILY_LIMIT", `De dagelijkse ${providerLabel}-limiet van ${dailyLimit} bewerkingen is bereikt.`, 429);
    const usage = await tx.designProviderUsage.findUniqueOrThrow({ where: { dayKey_provider: { dayKey, provider } } });
    await tx.designJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });
    return usage.attempts;
  });
}

function sameOptions(left: Prisma.JsonValue, right: PhotoRoomJobInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function createPhotoRoomDraft(input: {
  adminUserId: string;
  idempotencyKey: string;
  options: PhotoRoomJobInput;
}): Promise<{ jobId: string; asset: DesignAssetDto; attemptsUsed: number; dailyLimit: number; replayed: boolean }> {
  const { adminUserId, idempotencyKey, options } = input;
  const existing = await prisma.designJob.findUnique({ where: { idempotencyKey }, include: { assets: true } });
  if (existing) {
    if (existing.requestedByAdminUserId !== adminUserId || existing.productId !== options.productId || !sameOptions(existing.options, options)) {
      throw new DesignStudioError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode is al voor een andere bewerking gebruikt.", 409);
    }
    const asset = existing.assets[0];
    if (existing.status === "SUCCEEDED" && asset) {
      return { jobId: existing.id, asset: designAssetDto(asset), attemptsUsed: 0, dailyLimit: PHOTOROOM_DAILY_LIMIT, replayed: true };
    }
    if (existing.status === "PROCESSING" || existing.status === "QUEUED") {
      throw new DesignStudioError("JOB_IN_PROGRESS", "Deze bewerking wordt al uitgevoerd.", 409);
    }
    throw new DesignStudioError(existing.errorCode || "JOB_FAILED", existing.errorMessage || "Deze bewerking is eerder mislukt.", 409);
  }

  const source = await prisma.productImage.findFirst({
    where: { id: options.imageId, productId: options.productId },
    select: { id: true, productId: true, storageKey: true },
  });
  if (!source) throw new DesignStudioError("SOURCE_NOT_FOUND", "De gekozen afbeelding hoort niet bij dit product.", 404);

  // Check the provider balance before creating a job or consuming the internal daily limit.
  await assertPhotoRoomAvailable();

  let job;
  try {
    job = await prisma.designJob.create({
      data: {
        productId: source.productId,
        sourceImageId: source.id,
        requestedByAdminUserId: adminUserId,
        idempotencyKey,
        options,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DesignStudioError("JOB_IN_PROGRESS", "Deze bewerking wordt al uitgevoerd.", 409);
    }
    throw error;
  }

  let storageKey: string | null = null;
  try {
    const attemptsUsed = await consumeDesignProviderAttempt(job.id, "PHOTOROOM", PHOTOROOM_DAILY_LIMIT, "PhotoRoom");
    const sourceBytes = await loadProductImageBytes(source.storageKey);
    const output = await runPhotoRoomEdit(sourceBytes, options);
    storageKey = `products/${safeDesignId(source.productId)}/studio/photoroom/${safeDesignId(job.id)}-${randomUUID()}.webp`;
    await saveProductImage(storageKey, output.bytes, output.contentType);

    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.designAsset.create({
        data: {
          jobId: job.id,
          productId: source.productId,
          sourceImageId: source.id,
          storageKey: storageKey!,
          contentType: output.contentType,
          width: output.width,
          height: output.height,
          fileSize: output.bytes.length,
          status: "DRAFT",
        },
      });
      await tx.designJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", providerRequestId: output.providerRequestId, errorCode: null, errorMessage: null },
      });
      await tx.auditLog.create({
        data: { adminUserId, action: "CREATE", entityType: "DesignAsset", entityId: created.id, after: { productId: source.productId, sourceImageId: source.id, status: "DRAFT" } },
      });
      return created;
    });
    return { jobId: job.id, asset: designAssetDto(asset), attemptsUsed, dailyLimit: PHOTOROOM_DAILY_LIMIT, replayed: false };
  } catch (error) {
    if (storageKey) await deleteProductImage(storageKey).catch(() => undefined);
    const mapped = error instanceof DesignStudioError || error instanceof PhotoRoomError
      ? error
      : new DesignStudioError("PROCESSING_FAILED", "De productfoto kon niet veilig worden verwerkt.", 500);
    await prisma.designJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCode: mapped.code, errorMessage: mapped.message } }).catch(() => undefined);
    console.error("Design Studio job failed", { jobId: job.id, productId: source.productId, code: mapped.code });
    throw mapped;
  }
}

export async function publishDesignAsset(input: { adminUserId: string; jobId: string; assetId: string }) {
  const current = await prisma.designAsset.findFirst({
    where: { id: input.assetId, jobId: input.jobId },
    include: { job: { select: { requestedByAdminUserId: true } }, productImage: true },
  });
  if (!current) throw new DesignStudioError("ASSET_NOT_FOUND", "Het conceptresultaat bestaat niet.", 404);
  if (current.status === "DISCARDED") throw new DesignStudioError("ASSET_DISCARDED", "Dit concept is al verwijderd.", 409);
  if (current.status === "PUBLISHED" && current.productImage) return { asset: designAssetDto(current), image: current.productImage, replayed: true };

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DesignAsset" WHERE id = ${current.id} FOR UPDATE`;
    const lockedAsset = await tx.designAsset.findUnique({
      where: { id: current.id },
      include: { productImage: true },
    });
    if (!lockedAsset) throw new DesignStudioError("ASSET_NOT_FOUND", "Het conceptresultaat bestaat niet.", 404);
    if (lockedAsset.status === "PUBLISHED" && lockedAsset.productImage) {
      return { asset: lockedAsset, image: lockedAsset.productImage };
    }
    if (lockedAsset.status !== "DRAFT") throw new DesignStudioError("ASSET_NOT_AVAILABLE", "Dit concept kan niet meer worden gepubliceerd.", 409);
    await lockProductImages(tx, current.productId);
    const ordered = await getOrderedProductImages(tx, current.productId);
    const image = await tx.productImage.create({
      data: {
        productId: current.productId,
        storageKey: current.storageKey,
        alt: null,
        sortOrder: ordered.length,
        isPrimary: false,
      },
    });
    const asset = await tx.designAsset.update({ where: { id: lockedAsset.id }, data: { status: "PUBLISHED", productImageId: image.id } });
    await tx.auditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "UPDATE",
        entityType: "DesignAsset",
        entityId: lockedAsset.id,
        before: { status: lockedAsset.status, productImageId: lockedAsset.productImageId },
        after: { status: "PUBLISHED", productImageId: image.id },
      },
    });
    return { asset, image };
  }, productImageTransactionOptions);
  await revalidateProductImageStorefront(current.productId);
  return { asset: designAssetDto(result.asset), image: result.image, replayed: false };
}

function isDesignStudioProviderError(error: unknown): error is Error & { code: string; status: number } {
  return error instanceof Error
    && "code" in error && typeof error.code === "string"
    && "status" in error && typeof error.status === "number";
}

export function mapDesignStudioError(error: unknown): { status: number; body: { error: string; message: string } } {
  if (error instanceof DesignStudioError || error instanceof PhotoRoomError || isDesignStudioProviderError(error)) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "De Design Studio-aanvraag is niet gelukt." } };
}
