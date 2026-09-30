import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { youtubeId } from "@/lib/newsletter/video";
import { publicStorageUrl } from "@/lib/storage";

export const runtime = "nodejs";

const inputSchema = z.object({
  videoUrl: z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u),
  /** An uploaded still; not needed for YouTube videos. */
  imageUrl: z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u).optional(),
}).strict();

// Only our own media bucket and YouTube's thumbnail server; never an arbitrary address.
function allowedImageSource(url: string): boolean {
  const cdn = process.env.CDN_BASE_URL?.replace(/\/+$/u, "");
  return url.startsWith("https://img.youtube.com/vi/") || Boolean(cdn && url.startsWith(`${cdn}/`));
}

// Email clients cannot play video, so a video block shows a still with a play button
// that links to the video. This bakes the play button into the still once.
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Vul een geldige videolink in." }, { status: 422 });

  const id = youtubeId(parsed.data.videoUrl);
  const source = parsed.data.imageUrl ?? (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null);
  if (!source) return NextResponse.json({ error: "IMAGE_REQUIRED", message: "Upload een stilstaand beeld voor deze video, of gebruik een YouTube-link." }, { status: 422 });
  if (!allowedImageSource(source)) return NextResponse.json({ error: "IMAGE_SOURCE", message: "Gebruik een afbeelding uit de mediabibliotheek of een YouTube-video." }, { status: 422 });

  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!response?.ok) return NextResponse.json({ error: "IMAGE_UNAVAILABLE", message: "Het beeld kon niet worden opgehaald." }, { status: 502 });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) return NextResponse.json({ error: "IMAGE_TOO_LARGE", message: "Het beeld is te groot." }, { status: 422 });

  const sharp = (await import("sharp")).default;
  const base = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 675, fit: "cover" });
  const play = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><circle cx="600" cy="337" r="72" fill="#000" fill-opacity="0.55"/><circle cx="600" cy="337" r="72" fill="none" stroke="#fff" stroke-width="6"/><path d="M578 297 L578 377 L646 337 Z" fill="#fff"/></svg>`);
  const jpeg = await base.composite([{ input: play }]).jpeg({ quality: 85 }).toBuffer();

  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED", message: "Opslag is niet geconfigureerd." }, { status: 503 });
  const key = `newsletter/video-thumbnails/${randomUUID()}.jpg`;
  await new Storage().bucket(bucketName).file(key).save(jpeg, { contentType: "image/jpeg", metadata: { cacheControl: "public, max-age=31536000, immutable" } });
  return NextResponse.json({ thumbnailUrl: publicStorageUrl(key) });
}
