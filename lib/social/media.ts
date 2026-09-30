import "server-only";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";

import { prisma } from "@/lib/prisma";
import { publicStorageUrl } from "@/lib/storage";
import {
  SOCIAL_MAX_IMAGE_BYTES,
  SOCIAL_MAX_VIDEO_BYTES,
  socialMediaKind,
} from "./platforms";
import { SocialError } from "./errors";

// Social media files live in the public bucket under social/. Browsers cannot upload to
// the bucket directly (no CORS), so the composer sends 8 MB chunks to our API, which
// forwards them into a resumable Cloud Storage upload. Large videos never pass through
// memory in one piece and never hit Cloud Run's 32 MB request limit.

export const SOCIAL_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024; // a multiple of 256 KiB, as GCS requires

let storageClient: Storage | null = null;
function bucket() {
  const name = process.env.GCS_BUCKET;
  if (!name) throw new SocialError("STORAGE_NOT_CONFIGURED", "Opslag is niet geconfigureerd.", 503);
  storageClient ??= new Storage();
  return storageClient.bucket(name);
}

function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/u).pop() ?? "bestand";
  const cleaned = base.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^[-.]+|[-.]+$/gu, "");
  return cleaned.slice(-80) || "bestand";
}

export type SocialMediaDto = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  kind: "image" | "video";
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

export function socialMediaDto(asset: {
  id: string; storageKey: string; originalFilename: string; contentType: string; sizeBytes: number; width: number | null; height: number | null;
}): SocialMediaDto {
  return {
    id: asset.id,
    url: publicStorageUrl(asset.storageKey),
    filename: asset.originalFilename,
    contentType: asset.contentType,
    kind: socialMediaKind(asset.contentType) ?? "image",
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
  };
}

export async function startSocialUpload(input: { filename: string; contentType: string; sizeBytes: number }) {
  const kind = socialMediaKind(input.contentType);
  if (!kind) throw new SocialError("MEDIA_TYPE", "Gebruik een JPG-, PNG- of WebP-foto, of een MP4-, MOV- of WebM-video.", 422);
  const max = kind === "image" ? SOCIAL_MAX_IMAGE_BYTES : SOCIAL_MAX_VIDEO_BYTES;
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > max) {
    throw new SocialError("MEDIA_SIZE", kind === "image" ? "Een foto mag maximaal 20 MB zijn." : "Een video mag maximaal 1 GB zijn.", 422);
  }
  const storageKey = `social/${randomUUID()}/${safeFilename(input.filename)}`;
  const [uploadSessionUri] = await bucket().file(storageKey).createResumableUpload({
    metadata: { contentType: input.contentType, cacheControl: "public, max-age=31536000, immutable" },
  });
  const asset = await prisma.socialMediaAsset.create({
    data: {
      storageKey,
      originalFilename: input.filename.slice(0, 200),
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadSessionUri,
    },
  });
  return { id: asset.id, chunkBytes: SOCIAL_UPLOAD_CHUNK_BYTES };
}

/** Appends one chunk at the given offset; returns the bytes stored so far. */
export async function appendSocialUploadChunk(id: string, offset: number, chunk: Buffer, fetchImpl: typeof fetch = fetch) {
  const asset = await prisma.socialMediaAsset.findUnique({ where: { id } });
  if (!asset || asset.completedAt || !asset.uploadSessionUri) throw new SocialError("UPLOAD_NOT_OPEN", "Deze upload is al afgerond of bestaat niet.", 409);
  if (offset !== asset.uploadedBytes) throw new SocialError("UPLOAD_OFFSET", "De upload liep uit de pas. Begin opnieuw.", 409);
  const end = offset + chunk.length;
  const last = end === asset.sizeBytes;
  if (end > asset.sizeBytes || (!last && chunk.length % (256 * 1024) !== 0)) {
    throw new SocialError("UPLOAD_CHUNK", "Ongeldig uploaddeel.", 422);
  }
  const response = await fetchImpl(asset.uploadSessionUri, {
    method: "PUT",
    headers: { "content-length": String(chunk.length), "content-range": `bytes ${offset}-${end - 1}/${asset.sizeBytes}` },
    body: new Uint8Array(chunk),
  });
  // 308 = more expected, 200/201 = upload complete.
  if (response.status !== 308 && !response.ok) {
    throw new SocialError("UPLOAD_FAILED", `Opslaan van het bestand mislukte (${response.status}).`, 502);
  }
  await prisma.socialMediaAsset.update({ where: { id }, data: { uploadedBytes: end } });
  return end;
}

/** Marks the upload complete after checking the stored object; reads image dimensions. */
export async function completeSocialUpload(id: string): Promise<SocialMediaDto> {
  const asset = await prisma.socialMediaAsset.findUnique({ where: { id } });
  if (!asset) throw new SocialError("MEDIA_NOT_FOUND", "Dit bestand bestaat niet.", 404);
  if (asset.completedAt) return socialMediaDto(asset);
  const file = bucket().file(asset.storageKey);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) !== asset.sizeBytes) throw new SocialError("UPLOAD_INCOMPLETE", "Het bestand is nog niet volledig geüpload.", 409);

  let width: number | null = null;
  let height: number | null = null;
  if (socialMediaKind(asset.contentType) === "image") {
    const sharp = (await import("sharp")).default;
    const [bytes] = await file.download();
    try {
      const info = await sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 }).metadata();
      width = info.width ?? null;
      height = info.height ?? null;
    } catch {
      await file.delete({ ignoreNotFound: true });
      await prisma.socialMediaAsset.delete({ where: { id } });
      throw new SocialError("MEDIA_UNREADABLE", "Deze foto kon niet worden gelezen.", 422);
    }
  }
  const saved = await prisma.socialMediaAsset.update({
    where: { id },
    data: { completedAt: new Date(), uploadSessionUri: null, width, height },
  });
  return socialMediaDto(saved);
}

export async function loadSocialMedia(ids: readonly string[]) {
  if (!ids.length) return [];
  const assets = await prisma.socialMediaAsset.findMany({ where: { id: { in: [...ids] }, completedAt: { not: null } } });
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return ids.map((id) => byId.get(id)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
}

/** Streams a stored file (for platforms that need the bytes: TikTok and YouTube). */
export function openSocialMediaStream(storageKey: string, range?: { start: number; end: number }): Readable {
  return bucket().file(storageKey).createReadStream(range ? { start: range.start, end: range.end } : {});
}

/** Instagram only accepts JPEG photos: returns a public JPEG URL, converting once if needed. */
export async function jpegUrlFor(asset: { storageKey: string; contentType: string }): Promise<string> {
  if (asset.contentType === "image/jpeg") return publicStorageUrl(asset.storageKey);
  const jpegKey = `${asset.storageKey.replace(/\.[a-z0-9]+$/u, "")}.instagram.jpg`;
  const target = bucket().file(jpegKey);
  const [exists] = await target.exists();
  if (!exists) {
    const sharp = (await import("sharp")).default;
    const [bytes] = await bucket().file(asset.storageKey).download();
    const jpeg = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    await target.save(jpeg, { contentType: "image/jpeg", metadata: { cacheControl: "public, max-age=31536000, immutable" } });
  }
  return publicStorageUrl(jpegKey);
}
