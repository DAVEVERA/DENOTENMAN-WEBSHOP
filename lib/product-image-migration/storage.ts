import { Storage } from "@google-cloud/storage";
import type { GeneratedImage } from "@/lib/product-image-migration/variants";

export type SourceObject = {
  bytes: Buffer;
  generation: string;
  contentType: string | null;
  size: number;
};

export type DerivedUpload = {
  key: string;
  generation: string;
  image: GeneratedImage;
};

const safeIdentifier = /^[A-Za-z0-9_-]{1,160}$/;

function requireBucketName(environment: NodeJS.ProcessEnv = process.env): string {
  const name = environment.GCS_BUCKET?.trim();
  if (!name) throw new Error("GCS_BUCKET is not configured");
  return name;
}

export function assertSafeIdentifier(value: string, label: string): void {
  if (!safeIdentifier.test(value)) {
    throw new Error(`${label} contains unsafe storage-path characters`);
  }
}

export function buildDerivedImagePrefix(input: {
  productId: string;
  imageId: string;
  processingVersion: string;
  runId: string;
}): string {
  assertSafeIdentifier(input.productId, "productId");
  assertSafeIdentifier(input.imageId, "imageId");
  assertSafeIdentifier(input.processingVersion, "processingVersion");
  assertSafeIdentifier(input.runId, "runId");
  return `products/${input.productId}/derived/${input.processingVersion}/${input.imageId}/${input.runId}`;
}

export function buildDerivedImageKey(prefix: string, image: GeneratedImage): string {
  const filename = image.name === "master"
    ? `master.${image.format}`
    : `${image.name}.${image.format}`;
  return `${prefix}/${filename}`;
}

export class ProductImageMigrationStorage {
  private readonly bucket;

  constructor(
    bucketName = requireBucketName(),
    storage = new Storage()
  ) {
    this.bucket = storage.bucket(bucketName);
  }

  async inspectSource(storageKey: string): Promise<Omit<SourceObject, "bytes">> {
    if (!storageKey || storageKey.startsWith("/") || storageKey.includes("\\")) {
      throw new Error("Source storage key is invalid");
    }
    const [metadata] = await this.bucket.file(storageKey).getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error("Source object has invalid size metadata");
    }
    return {
      generation: String(metadata.generation ?? ""),
      contentType: metadata.contentType ?? null,
      size,
    };
  }

  async downloadSource(storageKey: string, maxBytes: number): Promise<SourceObject> {
    const inspected = await this.inspectSource(storageKey);
    if (inspected.size > maxBytes) {
      throw new Error(`Source object exceeds the ${maxBytes}-byte limit`);
    }
    const [bytes] = await this.bucket
      .file(storageKey, { generation: inspected.generation })
      .download();
    if (bytes.length !== inspected.size) {
      throw new Error("Downloaded source size does not match object metadata");
    }
    return { ...inspected, bytes };
  }

  async uploadDerived(
    key: string,
    image: GeneratedImage,
    metadata: Record<string, string>
  ): Promise<DerivedUpload> {
    if (!key.includes("/derived/") || key.startsWith("/") || key.includes("\\")) {
      throw new Error("Refusing to upload outside the derived image namespace");
    }
    const file = this.bucket.file(key);
    await file.save(image.bytes, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: image.format === "webp" ? "image/webp" : "image/avif",
        cacheControl: "public, max-age=31536000, immutable",
        metadata,
      },
    });
    const [stored] = await file.getMetadata();
    if (Number(stored.size ?? 0) !== image.bytes.length) {
      throw new Error(`Uploaded object ${key} failed its size verification`);
    }
    return { key, generation: String(stored.generation ?? ""), image };
  }

  async removeDerived(key: string, generation: string): Promise<void> {
    if (!key.includes("/derived/")) {
      throw new Error("Refusing to delete outside the derived image namespace");
    }
    if (!/^\d+$/.test(generation)) {
      throw new Error("Refusing to delete a derived object without an exact generation");
    }
    await this.bucket.file(key, { generation }).delete({ ignoreNotFound: true });
  }
}
