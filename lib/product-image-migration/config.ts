export const IMAGE_PROCESSING_VERSION = "circle-center-v1";

export type ImageVariantName = "thumbnail" | "card" | "product";

export type ImageMigrationConfig = {
  processingVersion: string;
  detectionMaxDimension: number;
  marginRatio: number;
  confidenceThreshold: number;
  ambiguityDelta: number;
  minRadiusRatio: number;
  maxRadiusRatio: number;
  hough: {
    dp: number;
    minDistanceRatio: number;
    cannyThreshold: number;
    accumulatorThreshold: number;
    blurKernelSize: number;
    edgeSearchRadius: number;
  };
  variants: Record<ImageVariantName, number>;
  webpQuality: number;
  avifQuality: number;
  maxSourceBytes: number;
  maxSourcePixels: number;
  concurrency: number;
};

export const defaultImageMigrationConfig: ImageMigrationConfig = {
  processingVersion: IMAGE_PROCESSING_VERSION,
  detectionMaxDimension: 1_024,
  marginRatio: 0.12,
  confidenceThreshold: 0.55,
  ambiguityDelta: 0.08,
  minRadiusRatio: 0.18,
  maxRadiusRatio: 0.49,
  hough: {
    dp: 1.2,
    minDistanceRatio: 0.25,
    cannyThreshold: 100,
    accumulatorThreshold: 42,
    blurKernelSize: 9,
    edgeSearchRadius: 2,
  },
  variants: {
    thumbnail: 400,
    card: 800,
    product: 1_600,
  },
  webpQuality: 82,
  avifQuality: 50,
  maxSourceBytes: 32 * 1024 * 1024,
  maxSourcePixels: 40_000_000,
  concurrency: 1,
};

function readNumber(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = environment[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}`);
  }
  return value;
}

export function resolveImageMigrationConfig(
  environment: NodeJS.ProcessEnv = process.env
): ImageMigrationConfig {
  return {
    ...defaultImageMigrationConfig,
    marginRatio: readNumber(
      environment,
      "IMAGE_MIGRATION_MARGIN_RATIO",
      defaultImageMigrationConfig.marginRatio,
      0,
      0.5
    ),
    confidenceThreshold: readNumber(
      environment,
      "IMAGE_MIGRATION_CONFIDENCE_THRESHOLD",
      defaultImageMigrationConfig.confidenceThreshold,
      0,
      1
    ),
    concurrency: Math.trunc(
      readNumber(
        environment,
        "IMAGE_MIGRATION_CONCURRENCY",
        defaultImageMigrationConfig.concurrency,
        1,
        2
      )
    ),
  };
}
