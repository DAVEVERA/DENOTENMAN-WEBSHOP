import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { can, type Role } from "@/lib/roles";

const storage = new Storage();

const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedContentType = (typeof allowedContentTypes)[number];

const uploadUrlTtlMs = 10 * 60 * 1000;

function bucket() {
  const bucketName = process.env.GCS_BUCKET;

  if (!bucketName) {
    throw new Error("GCS_BUCKET is not configured");
  }

  return storage.bucket(bucketName);
}

export function publicImageUrl(storageKey: string): string {
  const cdnBaseUrl = process.env.CDN_BASE_URL;

  if (!cdnBaseUrl) {
    throw new Error("CDN_BASE_URL is not configured");
  }

  return `${cdnBaseUrl.replace(/\/+$/, "")}/${storageKey}`;
}

export const publicStorageUrl = publicImageUrl;

function sanitizeKeySegment(value: string, label: string): string {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error(`Invalid ${label}`);
  }
  return sanitized;
}

/** Builds an immutable key from database identity, never from a mutable slug. */
export function buildProductAssetKey(productId: string, namespace: string, filename: string): string {
  if (filename.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filename) || filename.includes("..")) {
    throw new Error("Filename must not contain an absolute or traversing path");
  }
  const safeProductId = sanitizeKeySegment(productId, "product id");
  const safeNamespace = namespace
    .split("/")
    .map((segment) => sanitizeKeySegment(segment, "asset namespace"))
    .join("/");
  return `products/by-id/${safeProductId}/${safeNamespace}/${randomUUID()}.${extractExtension(filename)}`;
}

export async function saveImmutableProductAsset(
  storageKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await bucket().file(storageKey).save(bytes, {
    resumable: false,
    validation: "crc32c",
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
  });
}

export async function readProductAsset(storageKey: string, maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const [metadata] = await bucket().file(storageKey).getMetadata();
  const size = Number(metadata.size ?? 0);
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    throw new Error("Stored asset exceeds the permitted read size");
  }
  const [bytes] = await bucket().file(storageKey).download();
  if (bytes.length > maxBytes) throw new Error("Stored asset exceeds the permitted read size");
  return bytes;
}

export async function deleteProductAsset(storageKey: string): Promise<void> {
  await bucket().file(storageKey).delete({ ignoreNotFound: true });
}

export async function createUploadUrl(
  storageKey: string,
  contentType: string,
  role: Role
): Promise<string> {
  if (!can(role, "media", "write")) {
    throw new Error("Role is not permitted to write media");
  }

  if (!isAllowedContentType(contentType)) {
    throw new Error(`Content type not allowed: ${contentType}`);
  }

  const [url] = await bucket().file(storageKey).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + uploadUrlTtlMs,
    contentType,
  });

  return url;
}

export function isAllowedContentType(
  contentType: string
): contentType is AllowedContentType {
  return (allowedContentTypes as readonly string[]).includes(contentType);
}

function sanitizeSlug(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) {
    throw new Error("Invalid product slug");
  }

  return sanitized;
}

function extractExtension(filename: string): string {
  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error("Filename must not contain path segments");
  }

  if (filename.startsWith(".")) {
    throw new Error("Filename must not resolve to an empty base name");
  }

  const parts = filename.split(".");

  if (parts.length < 2) {
    throw new Error("Filename must include an extension");
  }

  const extension = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!extension) {
    throw new Error("Filename extension must not be empty");
  }

  return extension;
}

export function buildMediaLibraryKey(filename: string): string {
  if (filename.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filename)) {
    throw new Error("Filename must not be an absolute path");
  }

  if (filename.includes("..")) {
    throw new Error("Filename must not contain path traversal segments");
  }

  return `media-library/${randomUUID()}.${extractExtension(filename)}`;
}

export function buildProductImageKey(productSlug: string, filename: string): string {
  if (filename.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filename)) {
    throw new Error("Filename must not be an absolute path");
  }

  if (filename.includes("..")) {
    throw new Error("Filename must not contain path traversal segments");
  }

  const slug = sanitizeSlug(productSlug);
  const extension = extractExtension(filename);

  return `products/${slug}/${randomUUID()}.${extension}`;
}

export async function saveProductImage(
  storageKey: string,
  bytes: Buffer,
  contentType: AllowedContentType
): Promise<void> {
  await bucket().file(storageKey).save(bytes, {
    resumable: false,
    validation: "crc32c",
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
}

export async function deleteProductImage(storageKey: string): Promise<void> {
  await bucket().file(storageKey).delete({ ignoreNotFound: true });
}

export function hasValidImageSignature(bytes: Buffer, contentType: AllowedContentType): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return bytes.length >= 12 && bytes.toString("ascii", 4, 12).startsWith("ftypavi");
}
