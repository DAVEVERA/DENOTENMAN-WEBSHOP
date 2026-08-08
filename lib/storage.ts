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
