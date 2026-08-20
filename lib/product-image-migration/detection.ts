import cvModule from "@techstark/opencv-js";
import sharp from "sharp";
import type { ImageMigrationConfig } from "@/lib/product-image-migration/config";
import type { Circle } from "@/lib/product-image-migration/crop";

type OpenCv = Awaited<typeof cvModule>;

export type CircleCandidate = Circle & {
  confidence: number;
};

export type CircleDetection =
  | {
      status: "detected";
      circle: CircleCandidate;
      candidates: CircleCandidate[];
      detectionWidth: number;
      detectionHeight: number;
    }
  | {
      status: "needs_manual_review";
      reason: "no_circle" | "ambiguous_circles" | "low_confidence";
      candidates: CircleCandidate[];
      detectionWidth: number;
      detectionHeight: number;
    };

let openCvPromise: Promise<OpenCv> | undefined;

export async function loadOpenCv(): Promise<OpenCv> {
  openCvPromise ??= Promise.resolve(cvModule).then((cv) => {
    if (typeof cv.Mat !== "function" || typeof cv.HoughCircles !== "function") {
      throw new Error("The installed OpenCV.js build does not include HoughCircles");
    }
    return cv;
  });
  return openCvPromise;
}

function edgeSupport(
  edges: Uint8Array,
  width: number,
  height: number,
  circle: Circle,
  searchRadius: number
): number {
  const samples = 360;
  let supported = 0;
  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    let found = false;
    for (let radialOffset = -searchRadius; radialOffset <= searchRadius && !found; radialOffset += 1) {
      const radius = circle.radius + radialOffset;
      const x = Math.round(circle.centerX + Math.cos(angle) * radius);
      const y = Math.round(circle.centerY + Math.sin(angle) * radius);
      for (let dy = -1; dy <= 1 && !found; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sampleX = x + dx;
          const sampleY = y + dy;
          if (
            sampleX >= 0 &&
            sampleX < width &&
            sampleY >= 0 &&
            sampleY < height &&
            edges[sampleY * width + sampleX] > 0
          ) {
            found = true;
            break;
          }
        }
      }
    }
    if (found) supported += 1;
  }
  return supported / samples;
}

export async function detectProductCircle(
  normalizedSource: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  config: ImageMigrationConfig
): Promise<CircleDetection> {
  const detectionScale = Math.min(
    1,
    config.detectionMaxDimension / Math.max(sourceWidth, sourceHeight)
  );
  const detectionWidth = Math.max(1, Math.round(sourceWidth * detectionScale));
  const detectionHeight = Math.max(1, Math.round(sourceHeight * detectionScale));
  const { data } = await sharp(normalizedSource, {
    failOn: "error",
    limitInputPixels: config.maxSourcePixels,
  })
    .resize({
      width: detectionWidth,
      height: detectionHeight,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cv = await loadOpenCv();
  const source = cv.matFromArray(detectionHeight, detectionWidth, cv.CV_8UC1, data);
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const circles = new cv.Mat();
  try {
    const kernel = config.hough.blurKernelSize;
    cv.GaussianBlur(source, blurred, new cv.Size(kernel, kernel), 2, 2, cv.BORDER_DEFAULT);
    cv.Canny(
      blurred,
      edges,
      config.hough.cannyThreshold / 2,
      config.hough.cannyThreshold
    );
    const minimumDimension = Math.min(detectionWidth, detectionHeight);
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      config.hough.dp,
      minimumDimension * config.hough.minDistanceRatio,
      config.hough.cannyThreshold,
      config.hough.accumulatorThreshold,
      Math.round(minimumDimension * config.minRadiusRatio),
      Math.round(minimumDimension * config.maxRadiusRatio)
    );

    const edgeBytes = new Uint8Array(edges.data);
    const values = circles.data32F;
    const candidates: CircleCandidate[] = [];
    for (let index = 0; index + 2 < values.length; index += 3) {
      const detectionCircle: Circle = {
        centerX: values[index],
        centerY: values[index + 1],
        radius: values[index + 2],
      };
      const confidence = edgeSupport(
        edgeBytes,
        detectionWidth,
        detectionHeight,
        detectionCircle,
        config.hough.edgeSearchRadius
      );
      candidates.push({
        centerX: detectionCircle.centerX / detectionScale,
        centerY: detectionCircle.centerY / detectionScale,
        radius: detectionCircle.radius / detectionScale,
        confidence,
      });
    }
    candidates.sort(
      (left, right) =>
        right.confidence - left.confidence ||
        right.radius - left.radius ||
        left.centerX - right.centerX
    );

    const best = candidates[0];
    if (!best) {
      return {
        status: "needs_manual_review",
        reason: "no_circle",
        candidates,
        detectionWidth,
        detectionHeight,
      };
    }
    if (best.confidence < config.confidenceThreshold) {
      return {
        status: "needs_manual_review",
        reason: "low_confidence",
        candidates,
        detectionWidth,
        detectionHeight,
      };
    }
    const second = candidates[1];
    if (second && best.confidence - second.confidence < config.ambiguityDelta) {
      return {
        status: "needs_manual_review",
        reason: "ambiguous_circles",
        candidates,
        detectionWidth,
        detectionHeight,
      };
    }
    return {
      status: "detected",
      circle: best,
      candidates,
      detectionWidth,
      detectionHeight,
    };
  } finally {
    circles.delete();
    edges.delete();
    blurred.delete();
    source.delete();
  }
}

export async function normalizeProductImage(
  source: Buffer,
  config: ImageMigrationConfig
): Promise<{ bytes: Buffer; width: number; height: number }> {
  if (source.length === 0 || source.length > config.maxSourceBytes) {
    throw new Error(`Source image must be between 1 and ${config.maxSourceBytes} bytes`);
  }
  const pipeline = sharp(source, {
    failOn: "error",
    limitInputPixels: config.maxSourcePixels,
  }).rotate();
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > config.maxSourcePixels) {
    throw new Error("Source image has invalid or excessive dimensions");
  }
  const bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  const normalizedMetadata = await sharp(bytes).metadata();
  if (!normalizedMetadata.width || !normalizedMetadata.height) {
    throw new Error("EXIF-normalized image has invalid dimensions");
  }
  return {
    bytes,
    width: normalizedMetadata.width,
    height: normalizedMetadata.height,
  };
}
