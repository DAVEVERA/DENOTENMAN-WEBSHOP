import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { sharpDiagnostics } from "@/lib/sharp-diagnostics";
import { saveImmutableProductAsset } from "@/lib/storage";
import { youtubeId, type VideoThumbnailAspect } from "./video";

export { VIDEO_THUMBNAIL_ASPECTS, type VideoThumbnailAspect } from "./video";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const THUMBNAIL_WIDTH = 1200;

const ASPECT_HEIGHT: Record<Exclude<VideoThumbnailAspect, "original">, number> = {
  "16:9": 675,
  "1:1": 1200,
  "4:5": 1500,
};
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export class VideoThumbnailError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VideoThumbnailError";
  }
}

export type VideoThumbnailEnvironment = {
  CDN_BASE_URL?: string;
  GCS_BUCKET?: string;
};

export type VideoThumbnailDependencies = {
  fetchImpl?: typeof fetch;
  save?: (storageKey: string, bytes: Buffer, contentType: string) => Promise<void>;
};

function isPathInside(pathname: string, basePathname: string): boolean {
  const base = basePathname.replace(/\/+$/u, "");
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Only the configured public media origin and YouTube's thumbnail endpoint are valid. */
export function isAllowedNewsletterThumbnailSource(rawUrl: string, cdnBaseUrl?: string): boolean {
  try {
    const candidate = new URL(rawUrl);
    if (candidate.protocol !== "https:" || candidate.username || candidate.password) return false;
    if (candidate.hostname === "img.youtube.com") {
      return /^\/vi\/[A-Za-z0-9_-]{11}\/(?:hqdefault|maxresdefault|sddefault|mqdefault|default)\.jpg$/u.test(candidate.pathname);
    }
    if (!cdnBaseUrl) return false;
    const cdn = new URL(cdnBaseUrl);
    return candidate.origin === cdn.origin && isPathInside(candidate.pathname, cdn.pathname || "/");
  } catch {
    return false;
  }
}

function sourceFor(videoUrl: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const id = youtubeId(videoUrl);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  throw new VideoThumbnailError(
    "IMAGE_REQUIRED",
    "Upload een stilstaand beeld voor deze video, of gebruik een YouTube-link.",
    422,
  );
}

async function downloadImage(source: string, fetchImpl: typeof fetch): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(source, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
    });
  } catch {
    throw new VideoThumbnailError("IMAGE_UNAVAILABLE", "Het beeld kon niet worden opgehaald.", 502);
  }
  if (!response.ok) throw new VideoThumbnailError("IMAGE_UNAVAILABLE", "Het beeld kon niet worden opgehaald.", 502);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (contentType.startsWith("video/")) {
    throw new VideoThumbnailError(
      "IMAGE_IS_VIDEO",
      "Dit is een video, geen stilstaand beeld. Kies een beeld uit de video of upload een foto.",
      422,
    );
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new VideoThumbnailError("IMAGE_TYPE", "Het gekozen bestand is geen ondersteunde afbeelding.", 422);
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SOURCE_BYTES) {
    throw new VideoThumbnailError("IMAGE_TOO_LARGE", "Het beeld is te groot.", 422);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) {
    throw new VideoThumbnailError("IMAGE_TOO_LARGE", "Het beeld is te groot.", 422);
  }
  return bytes;
}

function playButton(width: number, height: number): Buffer {
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const r = Math.round(Math.min(width, height) * 0.11);
  const t = Math.round(r * 0.55);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#000" fill-opacity="0.55"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${Math.max(3, Math.round(r / 12))}"/><path d="M${cx - Math.round(t * 0.55)} ${cy - t} L${cx - Math.round(t * 0.55)} ${cy + t} L${cx + Math.round(t * 0.95)} ${cy} Z" fill="#fff"/></svg>`,
  );
}

async function renderThumbnail(bytes: Buffer, aspect: VideoThumbnailAspect): Promise<Buffer> {
  try {
    const base = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const resized = aspect === "original"
      ? await base.resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: false }).toBuffer({ resolveWithObject: true })
      : await base.resize({ width: THUMBNAIL_WIDTH, height: ASPECT_HEIGHT[aspect], fit: "cover", position: "attention" }).toBuffer({ resolveWithObject: true });
    const { width, height } = resized.info;
    return await sharp(resized.data)
      .composite([{ input: playButton(width, height) }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    console.error("Newsletter thumbnail render failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      ...sharpDiagnostics(bytes),
    });
    throw new VideoThumbnailError("IMAGE_UNREADABLE", "Het beeld kon niet veilig worden verwerkt. Gebruik een JPG, PNG, WebP of GIF.", 422);
  }
}

export async function createNewsletterVideoThumbnail(
  input: { videoUrl: string; imageUrl?: string; aspect?: VideoThumbnailAspect },
  environment: VideoThumbnailEnvironment = { CDN_BASE_URL: process.env.CDN_BASE_URL, GCS_BUCKET: process.env.GCS_BUCKET },
  dependencies: VideoThumbnailDependencies = {},
): Promise<{ thumbnailUrl: string }> {
  if (!environment.GCS_BUCKET || !environment.CDN_BASE_URL) {
    throw new VideoThumbnailError("STORAGE_NOT_CONFIGURED", "Opslag is niet volledig geconfigureerd.", 503);
  }
  const source = sourceFor(input.videoUrl, input.imageUrl);
  if (!isAllowedNewsletterThumbnailSource(source, environment.CDN_BASE_URL)) {
    throw new VideoThumbnailError(
      "IMAGE_SOURCE",
      "Gebruik een afbeelding uit de mediabibliotheek of een YouTube-video.",
      422,
    );
  }
  const bytes = await downloadImage(source, dependencies.fetchImpl ?? fetch);
  const jpeg = await renderThumbnail(bytes, input.aspect ?? "16:9");
  const storageKey = `newsletter/video-thumbnails/${randomUUID()}.jpg`;
  try {
    await (dependencies.save ?? saveImmutableProductAsset)(storageKey, jpeg, "image/jpeg");
    return { thumbnailUrl: `${environment.CDN_BASE_URL.replace(/\/+$/u, "")}/${storageKey}` };
  } catch (error) {
    if (error instanceof VideoThumbnailError) throw error;
    console.error("Newsletter thumbnail storage failed", {
      message: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      code: typeof error === "object" && error !== null ? (error as { code?: unknown }).code ?? null : null,
    });
    throw new VideoThumbnailError("STORAGE_FAILED", "De miniatuur kon niet veilig worden opgeslagen.", 502);
  }
}
