import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteProductImage, saveProductImage } from "@/lib/storage";
import { loadProductImageBytes } from "@/lib/product-image-studio";
import {
  consumeDesignProviderAttempt,
  releaseDesignProviderAttempt,
  designAssetDto,
  DesignStudioError,
  safeDesignId,
} from "@/lib/design-studio/service";
import { generateGeminiProductImage, GeminiImageError } from "@/lib/design-studio/gemini-image-provider";
import type { GeminiImageJobInput } from "@/lib/design-studio/gemini-image-schema";
import type { DesignAssetDto } from "@/lib/design-studio/types";

const GEMINI_DAILY_LIMIT = 25;

function sameOptions(left: Prisma.JsonValue, right: GeminiImageJobInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function createGeminiImageDraft(input: {
  adminUserId: string;
  idempotencyKey: string;
  options: GeminiImageJobInput;
}): Promise<{ jobId: string; asset: DesignAssetDto; attemptsUsed: number; dailyLimit: number; replayed: boolean }> {
  const { adminUserId, idempotencyKey, options } = input;
  const existing = await prisma.designJob.findUnique({ where: { idempotencyKey }, include: { assets: true } });
  if (existing) {
    if (
      existing.provider !== "GEMINI"
      || existing.requestedByAdminUserId !== adminUserId
      || existing.productId !== options.productId
      || !sameOptions(existing.options, options)
    ) {
      throw new DesignStudioError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode is al voor een andere bewerking gebruikt.", 409);
    }
    const asset = existing.assets[0];
    if (existing.status === "SUCCEEDED" && asset) {
      return { jobId: existing.id, asset: designAssetDto(asset), attemptsUsed: 0, dailyLimit: GEMINI_DAILY_LIMIT, replayed: true };
    }
    if (existing.status === "PROCESSING" || existing.status === "QUEUED") {
      throw new DesignStudioError("JOB_IN_PROGRESS", "Deze Gemini-bewerking wordt al uitgevoerd.", 409);
    }
    throw new DesignStudioError(existing.errorCode || "JOB_FAILED", existing.errorMessage || "Deze Gemini-bewerking is eerder mislukt.", 409);
  }

  const source = await prisma.productImage.findFirst({
    where: { id: options.imageId, productId: options.productId },
    select: {
      id: true,
      productId: true,
      storageKey: true,
      product: { select: { translations: { where: { locale: "nl" }, select: { name: true }, take: 1 } } },
    },
  });
  if (!source) throw new DesignStudioError("SOURCE_NOT_FOUND", "De gekozen afbeelding hoort niet bij dit product.", 404);

  let job;
  try {
    job = await prisma.designJob.create({
      data: {
        productId: source.productId,
        sourceImageId: source.id,
        requestedByAdminUserId: adminUserId,
        idempotencyKey,
        provider: "GEMINI",
        options,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DesignStudioError("JOB_IN_PROGRESS", "Deze Gemini-bewerking wordt al uitgevoerd.", 409);
    }
    throw error;
  }

  const reservedAt = new Date();
  let reserved = false;
  let storageKey: string | null = null;
  try {
    const attemptsUsed = await consumeDesignProviderAttempt(job.id, "GEMINI", GEMINI_DAILY_LIMIT, "Gemini", reservedAt);
    reserved = true;
    const sourceBytes = await loadProductImageBytes(source.storageKey);
    const output = await generateGeminiProductImage(
      sourceBytes,
      options,
      source.product.translations[0]?.name || "De Notenman-product",
    );
    storageKey = `products/${safeDesignId(source.productId)}/studio/gemini/${safeDesignId(job.id)}-${randomUUID()}.webp`;
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
        data: {
          status: "SUCCEEDED",
          providerRequestId: output.providerRequestId,
          errorCode: null,
          errorMessage: null,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId,
          action: "CREATE",
          entityType: "DesignAsset",
          entityId: created.id,
          after: { productId: source.productId, sourceImageId: source.id, provider: "GEMINI", status: "DRAFT" },
        },
      });
      return created;
    });
    return { jobId: job.id, asset: designAssetDto(asset), attemptsUsed, dailyLimit: GEMINI_DAILY_LIMIT, replayed: false };
  } catch (error) {
    if (storageKey) await deleteProductImage(storageKey).catch(() => undefined);
    const definiteRejection = error instanceof GeminiImageError
      && ["NOT_CONFIGURED", "INVALID_CONFIGURATION", "PROVIDER_REJECTED", "INVALID_SOURCE"].includes(error.code);
    if (reserved && definiteRejection) await releaseDesignProviderAttempt(job.id, "GEMINI", reservedAt);
    const mapped = error instanceof DesignStudioError || error instanceof GeminiImageError
      ? error
      : new DesignStudioError("PROCESSING_FAILED", "Het Gemini-concept kon niet veilig worden verwerkt.", 500);
    await prisma.designJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorCode: mapped.code, errorMessage: mapped.message },
    }).catch(() => undefined);
    console.error("Design Studio Gemini image job failed", { jobId: job.id, productId: source.productId, code: mapped.code });
    throw mapped;
  }
}
