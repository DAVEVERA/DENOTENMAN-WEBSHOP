import sharp from "sharp";
import type {
  ImageMigrationConfig,
  ImageVariantName,
} from "@/lib/product-image-migration/config";
import type { SquareCrop } from "@/lib/product-image-migration/crop";

export type GeneratedImage = {
  name: "master" | ImageVariantName;
  format: "webp" | "avif";
  bytes: Buffer;
  width: number;
  height: number;
  targetSize: number | null;
};

async function encodeVariant(
  master: Buffer,
  name: ImageVariantName,
  targetSize: number,
  format: "webp" | "avif",
  config: ImageMigrationConfig
): Promise<GeneratedImage> {
  const resized = sharp(master, {
    failOn: "error",
    limitInputPixels: config.maxSourcePixels,
  }).resize({
    width: targetSize,
    height: targetSize,
    fit: "inside",
    withoutEnlargement: true,
    kernel: sharp.kernel.lanczos3,
  });
  const bytes = format === "webp"
    ? await resized.webp({ quality: config.webpQuality, smartSubsample: true }).toBuffer()
    : await resized.avif({ quality: config.avifQuality, effort: 5 }).toBuffer();
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error(`${name}.${format} did not produce a square image`);
  }
  if (metadata.width > targetSize || metadata.height > targetSize) {
    throw new Error(`${name}.${format} exceeded its configured maximum size`);
  }
  return {
    name,
    format,
    bytes,
    width: metadata.width,
    height: metadata.height,
    targetSize,
  };
}

export async function generateProductImageVariants(
  normalizedSource: Buffer,
  crop: SquareCrop,
  config: ImageMigrationConfig
): Promise<GeneratedImage[]> {
  const master = await sharp(normalizedSource, {
    failOn: "error",
    limitInputPixels: config.maxSourcePixels,
  })
    .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
    .webp({ lossless: true, effort: 5 })
    .toBuffer();
  const masterMetadata = await sharp(master).metadata();
  if (masterMetadata.width !== crop.size || masterMetadata.height !== crop.size) {
    throw new Error("Master crop dimensions do not match the crop plan");
  }

  const images: GeneratedImage[] = [
    {
      name: "master",
      format: "webp",
      bytes: master,
      width: crop.size,
      height: crop.size,
      targetSize: null,
    },
  ];
  for (const [name, targetSize] of Object.entries(config.variants) as Array<[
    ImageVariantName,
    number,
  ]>) {
    images.push(await encodeVariant(master, name, targetSize, "webp", config));
    images.push(await encodeVariant(master, name, targetSize, "avif", config));
  }
  return images;
}
