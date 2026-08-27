import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteProductImage, publicImageUrl, saveProductImage } from "@/lib/storage";
import {
  consumeDesignProviderAttempt,
  designAssetDto,
  DesignStudioError,
  safeDesignId,
} from "@/lib/design-studio/service";
import { createVModelTask, downloadVModelImage, getVModelTask, VModelError } from "@/lib/design-studio/vmodel-provider";
import { vModelJobSchema, type VModelJobDto, type VModelJobInput } from "@/lib/design-studio/vmodel-schema";

const VMODEL_DAILY_LIMIT = 25;

type JobWithAssets = Prisma.DesignJobGetPayload<{ include: { assets: true } }>;

function sameOptions(left: Prisma.JsonValue, right: VModelJobInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function vModelJobDto(job: JobWithAssets): VModelJobDto {
  const parsed = vModelJobSchema.safeParse(job.options);
  if (!parsed.success) throw new DesignStudioError("INVALID_JOB_OPTIONS", "De opgeslagen VModel-instellingen zijn ongeldig.", 500);
  return {
    id: job.id,
    productId: job.productId,
    sourceImageId: job.sourceImageId,
    status: job.status,
    modelId: parsed.data.modelId,
    asset: job.assets[0] ? designAssetDto(job.assets[0]) : null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
  };
}

async function markJobFailed(jobId: string, error: { code: string; message: string }): Promise<void> {
  await prisma.designJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorCode: error.code, errorMessage: error.message },
  }).catch(() => undefined);
}

export async function createVModelCampaignJob(input: {
  adminUserId: string;
  idempotencyKey: string;
  options: VModelJobInput;
}): Promise<{ job: VModelJobDto; attemptsUsed: number; dailyLimit: number; replayed: boolean }> {
  const { adminUserId, idempotencyKey, options } = input;
  const existing = await prisma.designJob.findUnique({ where: { idempotencyKey }, include: { assets: true } });
  if (existing) {
    if (
      existing.provider !== "VMODEL"
      || existing.requestedByAdminUserId !== adminUserId
      || existing.productId !== options.productId
      || !sameOptions(existing.options, options)
    ) {
      throw new DesignStudioError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode is al voor een andere bewerking gebruikt.", 409);
    }
    return { job: vModelJobDto(existing), attemptsUsed: 0, dailyLimit: VMODEL_DAILY_LIMIT, replayed: true };
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
        provider: "VMODEL",
        options,
      },
      include: { assets: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DesignStudioError("JOB_IN_PROGRESS", "Deze VModel-bewerking wordt al uitgevoerd.", 409);
    }
    throw error;
  }

  try {
    const attemptsUsed = await consumeDesignProviderAttempt(job.id, "VMODEL", VMODEL_DAILY_LIMIT, "VModel");
    const task = await createVModelTask(
      options,
      publicImageUrl(source.storageKey),
      source.product.translations[0]?.name || "De Notenman-product",
    );
    const updated = await prisma.designJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        providerRequestId: task.providerTaskId,
        errorCode: null,
        errorMessage: null,
      },
      include: { assets: true },
    });
    return { job: vModelJobDto(updated), attemptsUsed, dailyLimit: VMODEL_DAILY_LIMIT, replayed: false };
  } catch (error) {
    const mapped = error instanceof DesignStudioError || error instanceof VModelError
      ? error
      : new DesignStudioError("TASK_CREATE_FAILED", "De VModel-taak kon niet veilig worden gestart.", 500);
    await markJobFailed(job.id, mapped);
    console.error("Design Studio VModel create failed", { jobId: job.id, productId: source.productId, code: mapped.code });
    throw mapped;
  }
}

async function completedJob(jobId: string): Promise<JobWithAssets> {
  return prisma.designJob.findUniqueOrThrow({ where: { id: jobId }, include: { assets: true } });
}

export async function refreshVModelCampaignJob(jobId: string): Promise<VModelJobDto> {
  const job = await prisma.designJob.findFirst({ where: { id: jobId, provider: "VMODEL" }, include: { assets: true } });
  if (!job) throw new DesignStudioError("JOB_NOT_FOUND", "Deze VModel-taak bestaat niet.", 404);
  if (job.status === "SUCCEEDED" || job.status === "FAILED") return vModelJobDto(job);
  if (!job.providerRequestId) return vModelJobDto(job);

  let task;
  try {
    task = await getVModelTask(job.providerRequestId);
  } catch (error) {
    if (error instanceof VModelError && error.retryable) throw error;
    const mapped = error instanceof VModelError
      ? error
      : new DesignStudioError("STATUS_FAILED", "De VModel-status kon niet worden verwerkt.", 500);
    await markJobFailed(job.id, mapped);
    throw mapped;
  }

  if (task.status === "starting" || task.status === "processing") {
    if (job.status !== "PROCESSING") {
      const updated = await prisma.designJob.update({ where: { id: job.id }, data: { status: "PROCESSING" }, include: { assets: true } });
      return vModelJobDto(updated);
    }
    return vModelJobDto(job);
  }
  if (task.status === "failed" || task.status === "canceled") {
    const error = new DesignStudioError(
      task.status === "canceled" ? "PROVIDER_CANCELED" : "PROVIDER_FAILED",
      task.status === "canceled" ? "VModel heeft de taak geannuleerd." : "VModel kon dit beeld niet maken.",
      422,
    );
    await markJobFailed(job.id, error);
    return vModelJobDto(await completedJob(job.id));
  }
  const outputUrl = task.outputUrls[0];
  if (!outputUrl) {
    const error = new DesignStudioError("MISSING_OUTPUT", "VModel meldde succes zonder een afbeelding.", 502);
    await markJobFailed(job.id, error);
    throw error;
  }

  let storageKey: string | null = null;
  try {
    const output = await downloadVModelImage(outputUrl);
    storageKey = `products/${safeDesignId(job.productId)}/studio/vmodel/${safeDesignId(job.id)}.webp`;
    await saveProductImage(storageKey, output.bytes, output.contentType);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "DesignJob" WHERE id = ${job.id} FOR UPDATE`;
        const locked = await tx.designJob.findUnique({ where: { id: job.id }, include: { assets: true } });
        if (!locked) throw new DesignStudioError("JOB_NOT_FOUND", "Deze VModel-taak bestaat niet.", 404);
        if (locked.assets[0]) return;
        const created = await tx.designAsset.create({
          data: {
            jobId: locked.id,
            productId: locked.productId,
            sourceImageId: locked.sourceImageId,
            storageKey: storageKey!,
            contentType: output.contentType,
            width: output.width,
            height: output.height,
            fileSize: output.bytes.length,
            status: "DRAFT",
          },
        });
        await tx.designJob.update({
          where: { id: locked.id },
          data: { status: "SUCCEEDED", errorCode: null, errorMessage: null },
        });
        await tx.auditLog.create({
          data: {
            adminUserId: locked.requestedByAdminUserId,
            action: "CREATE",
            entityType: "DesignAsset",
            entityId: created.id,
            after: { productId: locked.productId, sourceImageId: locked.sourceImageId, provider: "VMODEL" },
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  } catch (error) {
    if (error instanceof VModelError && error.retryable) throw error;
    if (storageKey) await deleteProductImage(storageKey).catch(() => undefined);
    const mapped = error instanceof DesignStudioError || error instanceof VModelError
      ? error
      : new DesignStudioError("OUTPUT_PROCESSING_FAILED", "Het VModel-resultaat kon niet veilig worden opgeslagen.", 500);
    await markJobFailed(job.id, mapped);
    console.error("Design Studio VModel finalize failed", { jobId: job.id, productId: job.productId, code: mapped.code });
    throw mapped;
  }
  return vModelJobDto(await completedJob(job.id));
}
