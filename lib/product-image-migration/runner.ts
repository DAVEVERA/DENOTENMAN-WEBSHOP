import { createHash } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
  type ProductImageProcessing,
} from "@prisma/client";
import pLimit from "p-limit";
import { publicImageUrl } from "@/lib/storage";
import {
  calculateCenteredSquareCrop,
  type SquareCrop,
} from "@/lib/product-image-migration/crop";
import {
  detectProductCircle,
  normalizeProductImage,
  type CircleDetection,
} from "@/lib/product-image-migration/detection";
import type { ImageMigrationConfig } from "@/lib/product-image-migration/config";
import type {
  ProductImageMigrationReport,
  ProductImageMigrationResult,
  ProductImageVariantMetadata,
} from "@/lib/product-image-migration/report";
import {
  buildDerivedImageKey,
  buildDerivedImagePrefix,
  ProductImageMigrationStorage,
  type DerivedUpload,
} from "@/lib/product-image-migration/storage";
import {
  generateProductImageVariants,
  type GeneratedImage,
} from "@/lib/product-image-migration/variants";

type SelectedImage = Prisma.ProductImageGetPayload<{
  include: {
    product: {
      select: {
        id: true;
        sku: true;
        translations: { select: { name: true; locale: true } };
      };
    };
  };
}> & { processingRecords: ProductImageProcessing[] };

export type MigrationRunOptions = {
  dryRun: boolean;
  limit?: number;
  productId?: string;
  resume: boolean;
  force: boolean;
  runId: string;
};

export type MigrationRunDependencies = {
  prisma: PrismaClient;
  storage: ProductImageMigrationStorage;
  config: ImageMigrationConfig;
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown image migration error";
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (/^[A-Za-z0-9_-]{1,80}$/.test(code)) return code;
  }
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}

function localizedName(image: SelectedImage): string {
  return (
    image.product.translations.find((translation) => translation.locale === "nl")?.name ??
    image.product.translations[0]?.name ??
    image.product.sku
  );
}

function baseResult(image: SelectedImage): Pick<
  ProductImageMigrationResult,
  "productId" | "imageId" | "name" | "originalUrl"
> {
  return {
    productId: image.productId,
    imageId: image.id,
    name: localizedName(image),
    originalUrl: publicImageUrl(image.storageKey),
  };
}

function detectionMetadata(detection: CircleDetection) {
  const best = detection.candidates[0];
  if (!best) return undefined;
  return {
    centerX: Math.round(best.centerX * 100) / 100,
    centerY: Math.round(best.centerY * 100) / 100,
    radius: Math.round(best.radius * 100) / 100,
    confidence: Math.round(best.confidence * 10_000) / 10_000,
    candidateCount: detection.candidates.length,
  };
}

function cropMetadata(
  crop: SquareCrop,
  sourceWidth: number,
  sourceHeight: number,
  radius: number
) {
  return {
    left: crop.left,
    top: crop.top,
    size: crop.size,
    marginPixels: Math.max(0, Math.round(crop.size / 2 - radius)),
    sourceWidth,
    sourceHeight,
  };
}

function outputKeyMap(uploads: DerivedUpload[]): Record<string, string> {
  return Object.fromEntries(
    uploads.map((upload) => [`${upload.image.name}.${upload.image.format}`, upload.key])
  );
}

function imageByName(
  images: GeneratedImage[],
  name: GeneratedImage["name"],
  format: GeneratedImage["format"]
): GeneratedImage {
  const image = images.find((candidate) => candidate.name === name && candidate.format === format);
  if (!image) throw new Error(`Missing generated image ${name}.${format}`);
  return image;
}

function variantMetadata(
  images: GeneratedImage[],
  uploads: DerivedUpload[] | undefined
): ProductImageVariantMetadata[] {
  const urlsByName = uploads
    ? new Map(
        uploads.map((upload) => [
          `${upload.image.name}.${upload.image.format}`,
          publicImageUrl(upload.key),
        ])
      )
    : undefined;
  return images.map((image) => ({
    kind: image.name,
    format: image.format,
    width: image.width,
    height: image.height,
    byteLength: image.bytes.length,
    url: urlsByName?.get(`${image.name}.${image.format}`) ?? "dry-run:not-uploaded",
  }));
}

async function recordNonSuccess(
  dependencies: MigrationRunDependencies,
  image: SelectedImage,
  options: MigrationRunOptions,
  input: {
    status: "NEEDS_MANUAL_REVIEW" | "FAILED";
    sourceSha256?: string;
    sourceGeneration?: string;
    detection?: CircleDetection;
    crop?: SquareCrop;
    errorCode: string;
    errorMessage: string;
  }
): Promise<void> {
  if (options.dryRun) return;
  const where = {
    productImageId_processingVersion: {
      productImageId: image.id,
      processingVersion: dependencies.config.processingVersion,
    },
  } as const;
  const existing = await dependencies.prisma.productImageProcessing.findUnique({ where });
  if (
    shouldPreserveSuccessfulRecord(
      existing,
      options.force,
      image.storageKey,
      input.sourceGeneration
    )
  ) {
    return;
  }
  const best = input.detection?.candidates[0];
  const create = {
    productImageId: image.id,
    originalStorageKey: image.storageKey,
    sourceSha256: input.sourceSha256,
    sourceGeneration: input.sourceGeneration,
    status: input.status,
    processingVersion: dependencies.config.processingVersion,
    runId: options.runId,
    detectedCenterX: best?.centerX,
    detectedCenterY: best?.centerY,
    detectedRadius: best?.radius,
    detectedConfidence: best?.confidence,
    marginRatio: dependencies.config.marginRatio,
    cropLeft: input.crop?.left,
    cropTop: input.crop?.top,
    cropSize: input.crop?.size,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage.slice(0, 2_000),
    details: input.detection
      ? (JSON.parse(JSON.stringify(input.detection)) as Prisma.InputJsonValue)
      : undefined,
    attemptedAt: new Date(),
    processedAt: null,
  } satisfies Prisma.ProductImageProcessingUncheckedCreateInput;
  await dependencies.prisma.productImageProcessing.upsert({
    where,
    create,
    update: {
      ...create,
      masterWebpKey: null,
      thumbnailWebpKey: null,
      thumbnailAvifKey: null,
      cardWebpKey: null,
      cardAvifKey: null,
      productWebpKey: null,
      productAvifKey: null,
    },
  });
}

async function recordSuccess(
  dependencies: MigrationRunDependencies,
  image: SelectedImage,
  options: MigrationRunOptions,
  input: {
    sourceSha256: string;
    sourceGeneration: string;
    detection: Extract<CircleDetection, { status: "detected" }>;
    crop: SquareCrop;
    uploads: DerivedUpload[];
  }
): Promise<void> {
  const keys = outputKeyMap(input.uploads);
  const now = new Date();
  await dependencies.prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`product-image-migration:${image.id}`}))`
    );
    const current = await tx.productImage.findUnique({
      where: { id: image.id },
      select: { storageKey: true },
    });
    if (!current || current.storageKey !== image.storageKey) {
      throw new Error("Original image record changed during processing");
    }
    const data = {
      originalStorageKey: image.storageKey,
      sourceSha256: input.sourceSha256,
      sourceGeneration: input.sourceGeneration,
      status: "SUCCEEDED" as const,
      runId: options.runId,
      masterWebpKey: keys["master.webp"],
      thumbnailWebpKey: keys["thumbnail.webp"],
      thumbnailAvifKey: keys["thumbnail.avif"],
      cardWebpKey: keys["card.webp"],
      cardAvifKey: keys["card.avif"],
      productWebpKey: keys["product.webp"],
      productAvifKey: keys["product.avif"],
      detectedCenterX: input.detection.circle.centerX,
      detectedCenterY: input.detection.circle.centerY,
      detectedRadius: input.detection.circle.radius,
      detectedConfidence: input.detection.circle.confidence,
      marginRatio: dependencies.config.marginRatio,
      cropLeft: input.crop.left,
      cropTop: input.crop.top,
      cropSize: input.crop.size,
      errorCode: null,
      errorMessage: null,
      details: JSON.parse(
        JSON.stringify({
          detection: input.detection,
          uploads: input.uploads.map((upload) => ({
            key: upload.key,
            generation: upload.generation,
            format: upload.image.format,
            name: upload.image.name,
            width: upload.image.width,
            height: upload.image.height,
            byteLength: upload.image.bytes.length,
          })),
        })
      ) as Prisma.InputJsonValue,
      attemptedAt: now,
      processedAt: now,
    } satisfies Prisma.ProductImageProcessingUncheckedUpdateInput;
    await tx.productImageProcessing.upsert({
      where: {
        productImageId_processingVersion: {
          productImageId: image.id,
          processingVersion: dependencies.config.processingVersion,
        },
      },
      create: {
        ...data,
        productImageId: image.id,
        processingVersion: dependencies.config.processingVersion,
      },
      update: data,
    });
  });
}

async function processOneImage(
  dependencies: MigrationRunDependencies,
  image: SelectedImage,
  options: MigrationRunOptions
): Promise<ProductImageMigrationResult> {
  const base = baseResult(image);
  let sourceSha256: string | undefined;
  let sourceGeneration: string | undefined;
  let detection: CircleDetection | undefined;
  let crop: SquareCrop | undefined;
  let uploaded: DerivedUpload[] = [];
  let databaseCommitted = false;
  try {
    if (image.storageKey.includes("/derived/")) {
      return { ...base, status: "skipped", reason: "derived_source_is_not_an_original" };
    }
    const existing = image.processingRecords.find(
      (record) => record.processingVersion === dependencies.config.processingVersion
    );
    const inspected = await dependencies.storage.inspectSource(image.storageKey);
    sourceGeneration = inspected.generation;
    if (
      existing &&
      shouldSkipProcessedImage(existing, image.storageKey, sourceGeneration, options.force)
    ) {
      return {
        ...base,
        status: "skipped",
        reason: options.resume ? "already_processed" : "already_processed_use_force",
        previewUrl: existing.thumbnailWebpKey
          ? publicImageUrl(existing.thumbnailWebpKey)
          : undefined,
      };
    }

    const source = await dependencies.storage.downloadSource(
      image.storageKey,
      dependencies.config.maxSourceBytes
    );
    if (source.generation !== sourceGeneration) {
      throw new Error("Original object generation changed during download");
    }
    sourceSha256 = sha256(source.bytes);
    const normalized = await normalizeProductImage(source.bytes, dependencies.config);
    detection = await detectProductCircle(
      normalized.bytes,
      normalized.width,
      normalized.height,
      dependencies.config
    );
    if (detection.status === "needs_manual_review") {
      await recordNonSuccess(dependencies, image, options, {
        status: "NEEDS_MANUAL_REVIEW",
        sourceSha256,
        sourceGeneration,
        detection,
        errorCode: detection.reason.toUpperCase(),
        errorMessage: detection.reason,
      });
      return {
        ...base,
        status: "needs_manual_review",
        reason: detection.reason,
        sourceSha256,
        sourceGeneration,
        detection: detectionMetadata(detection),
      };
    }
    const cropPlan = calculateCenteredSquareCrop(
      normalized.width,
      normalized.height,
      detection.circle,
      dependencies.config.marginRatio
    );
    if (!cropPlan.ok) {
      await recordNonSuccess(dependencies, image, options, {
        status: "NEEDS_MANUAL_REVIEW",
        sourceSha256,
        sourceGeneration,
        detection,
        errorCode: cropPlan.reason.toUpperCase(),
        errorMessage: cropPlan.reason,
      });
      return {
        ...base,
        status: "needs_manual_review",
        reason: cropPlan.reason,
        sourceSha256,
        sourceGeneration,
        detection: detectionMetadata(detection),
      };
    }
    crop = cropPlan.crop;
    const generated = await generateProductImageVariants(
      normalized.bytes,
      crop,
      dependencies.config
    );
    if (options.dryRun) {
      const preview = imageByName(generated, "thumbnail", "webp");
      return {
        ...base,
        status: "success",
        reason: "dry_run_validated_no_upload",
        previewUrl: `data:image/webp;base64,${preview.bytes.toString("base64")}`,
        sourceSha256,
        sourceGeneration,
        detection: detectionMetadata(detection),
        crop: cropMetadata(
          crop,
          normalized.width,
          normalized.height,
          detection.circle.radius
        ),
        variants: variantMetadata(generated, undefined),
      };
    }

    const prefix = buildDerivedImagePrefix({
      productId: image.productId,
      imageId: image.id,
      processingVersion: dependencies.config.processingVersion,
      runId: options.runId,
    });
    for (const generatedImage of generated) {
      uploaded.push(
        await dependencies.storage.uploadDerived(
          buildDerivedImageKey(prefix, generatedImage),
          generatedImage,
          {
            productId: image.productId,
            productImageId: image.id,
            processingVersion: dependencies.config.processingVersion,
            runId: options.runId,
            sourceSha256,
            sourceGeneration,
          }
        )
      );
    }
    const previewUpload = uploaded.find(
      (upload) => upload.image.name === "thumbnail" && upload.image.format === "webp"
    );
    if (!previewUpload) throw new Error("Complete upload set has no thumbnail WebP");
    const successResult: ProductImageMigrationResult = {
      ...base,
      status: "success",
      previewUrl: publicImageUrl(previewUpload.key),
      sourceSha256,
      sourceGeneration,
      detection: detectionMetadata(detection),
      crop: cropMetadata(crop, normalized.width, normalized.height, detection.circle.radius),
      variants: variantMetadata(generated, uploaded),
    };
    await recordSuccess(dependencies, image, options, {
      sourceSha256,
      sourceGeneration,
      detection,
      crop,
      uploads: uploaded,
    });
    databaseCommitted = true;
    return successResult;
  } catch (error) {
    if (!databaseCommitted) {
      for (const upload of uploaded.reverse()) {
        await dependencies.storage
          .removeDerived(upload.key, upload.generation)
          .catch((cleanupError) => {
            console.error("Failed to remove a derived object after an incomplete image migration", {
              imageId: image.id,
              key: upload.key,
              cleanupError: errorMessage(cleanupError),
            });
          });
      }
      await recordNonSuccess(dependencies, image, options, {
        status: "FAILED",
        sourceSha256,
        sourceGeneration,
        detection,
        crop,
        errorCode: errorCode(error),
        errorMessage: errorMessage(error),
      }).catch((recordError) => {
        console.error("Failed to record product image migration failure", {
          imageId: image.id,
          recordError: errorMessage(recordError),
        });
      });
    }
    return {
      ...base,
      status: "failed",
      reason: errorMessage(error),
      sourceSha256,
      sourceGeneration,
      detection: detection ? detectionMetadata(detection) : undefined,
    };
  }
}

export function shouldSkipProcessedImage(
  existing: {
    status: string;
    originalStorageKey: string;
    sourceGeneration: string | null;
  } | undefined,
  currentStorageKey: string,
  currentGeneration: string,
  force: boolean
): boolean {
  return Boolean(
    existing?.status === "SUCCEEDED" &&
      existing.originalStorageKey === currentStorageKey &&
      existing.sourceGeneration === currentGeneration &&
      !force
  );
}

export function shouldPreserveSuccessfulRecord(
  existing: {
    status: string;
    originalStorageKey: string;
    sourceGeneration: string | null;
  } | null,
  force: boolean,
  currentStorageKey: string,
  currentGeneration: string | undefined
): boolean {
  return Boolean(
    existing?.status === "SUCCEEDED" &&
      force &&
      existing.originalStorageKey === currentStorageKey &&
      (!currentGeneration || existing.sourceGeneration === currentGeneration)
  );
}

export async function runProductImageMigration(
  dependencies: MigrationRunDependencies,
  options: MigrationRunOptions
): Promise<ProductImageMigrationReport> {
  const selectedProducts = await dependencies.prisma.product.findMany({
    where: options.productId ? { id: options.productId } : { images: { some: {} } },
    orderBy: { id: "asc" },
    take: options.productId ? 1 : options.limit,
    select: { id: true },
  });
  const productIds = selectedProducts.map((product) => product.id);
  const imageInclude = {
    product: {
      select: {
        id: true,
        sku: true,
        translations: { select: { name: true, locale: true } },
      },
    },
  } satisfies Prisma.ProductImageInclude;
  const baseQuery = {
    where: { productId: { in: productIds } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    include: imageInclude,
  } satisfies Prisma.ProductImageFindManyArgs;
  const images: SelectedImage[] = options.dryRun
    ? (await dependencies.prisma.productImage.findMany(baseQuery)).map((image) => ({
        ...image,
        processingRecords: [],
      }))
    : await dependencies.prisma.productImage.findMany({
      ...baseQuery,
      include: {
        ...imageInclude,
      processingRecords: {
        where: { processingVersion: dependencies.config.processingVersion },
      },
      },
    });
  const limit = pLimit(dependencies.config.concurrency);
  const results = await Promise.all(
    images.map((image) => limit(() => processOneImage(dependencies, image, options)))
  );
  return {
    generatedAt: new Date().toISOString(),
    processingVersion: dependencies.config.processingVersion,
    runId: options.runId,
    dryRun: options.dryRun,
    results,
  };
}
