import "server-only";

import sharp from "@/lib/sharp";

import { prisma } from "@/lib/prisma";
import { buildMediaLibraryKey, hasValidImageSignature, publicImageUrl, saveProductImage } from "@/lib/storage";
import { CanvaError, editUrlWithReturn, waitForCanvaJob, type CanvaDesign } from "./api";
import { canvaApi } from "./connection";
import { encodeCorrelation, type CanvaCorrelation } from "./return-token";
import { isOwnImageUrl } from "./sources";

// What the admin portal does with Canva: list designs, start one (blank or from one
// of our images) and bring a finished design back into the media library, so the
// newsletter, product photos and social posts use it from our own bucket.

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_DESIGN_EDGE = 4000;

export type ImportedCanvaImage = { id: string; url: string; width: number | null; height: number | null; page: number };

export async function listCanvaDesigns(query?: string, continuation?: string) {
  return canvaApi().listDesigns({ query, continuation });
}

function withReturn(design: CanvaDesign, correlation: CanvaCorrelation | null): CanvaDesign {
  if (!design.editUrl || !correlation) return design;
  return { ...design, editUrl: editUrlWithReturn(design.editUrl, encodeCorrelation(correlation)) };
}

export async function createBlankCanvaDesign(input: { title: string; width: number; height: number }, correlation: CanvaCorrelation | null) {
  return withReturn(await canvaApi().createDesign(input), correlation);
}

async function download(url: string, redirect: RequestRedirect): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetch(url, { redirect, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!response?.ok) throw new CanvaError("IMAGE_UNAVAILABLE", "Het beeld kon niet worden opgehaald.", 502);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) throw new CanvaError("IMAGE_TOO_LARGE", "Het beeld is groter dan 25 MB.", 422);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new CanvaError("IMAGE_TOO_LARGE", "Het beeld is groter dan 25 MB.", 422);
  return { bytes, contentType };
}

/** Sends one of our images to Canva and opens a design of the same proportions around it. */
export async function createCanvaDesignFromImage(input: { imageUrl: string; title: string }, correlation: CanvaCorrelation | null) {
  if (!isOwnImageUrl(input.imageUrl)) throw new CanvaError("IMAGE_SOURCE", "Gebruik een afbeelding uit de mediabibliotheek of de webshop.", 422);
  const { bytes } = await download(input.imageUrl, "error");
  let png: Buffer;
  let width: number;
  let height: number;
  try {
    const image = sharp(bytes, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
    const { data, info } = await image.resize({ width: MAX_DESIGN_EDGE, height: MAX_DESIGN_EDGE, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    png = data;
    width = info.width;
    height = info.height;
  } catch {
    throw new CanvaError("IMAGE_UNREADABLE", "Dit bestand is geen bruikbare afbeelding.", 422);
  }
  const api = canvaApi();
  const assetId = await waitForCanvaJob(await api.startAssetUpload(input.title || "De Notenman", png), (id) => api.getAssetUpload(id));
  const design = await api.createDesign({ title: input.title, width: Math.max(40, width), height: Math.max(40, height), assetId });
  return withReturn(design, correlation);
}

/** Exports a design and stores every page as an image in the media library. */
export async function importCanvaDesign(
  designId: string,
  options: { format: "png" | "jpg"; pages?: number[]; adminId: string },
): Promise<ImportedCanvaImage[]> {
  const api = canvaApi();
  const design = await api.getDesign(designId);
  const urls = await waitForCanvaJob(await api.startExport(designId, options.format, options.pages), (id) => api.getExport(id), { timeoutMs: 90_000 });
  const contentType = options.format === "jpg" ? "image/jpeg" : "image/png";
  const imported: ImportedCanvaImage[] = [];
  for (const [index, url] of urls.slice(0, 20).entries()) {
    // Canva hands out signed download links on its own CDN; they may redirect.
    const { bytes } = await download(url, "follow");
    if (!hasValidImageSignature(bytes, contentType)) throw new CanvaError("EXPORT_UNREADABLE", "Canva leverde een onleesbaar bestand.", 502);
    const metadata = await sharp(bytes).metadata().catch(() => null);
    const page = options.pages?.[index] ?? index + 1;
    const filename = `${design.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 80) || "Canva-design"}${urls.length > 1 ? ` (pagina ${page})` : ""}.${options.format}`;
    const storageKey = buildMediaLibraryKey(`canva.${options.format}`);
    await saveProductImage(storageKey, bytes, contentType);
    const asset = await prisma.mediaAsset.create({
      data: {
        storageKey,
        originalFilename: `Canva: ${filename}`,
        contentType,
        sizeBytes: bytes.length,
        width: metadata?.width ?? null,
        height: metadata?.height ?? null,
        altText: design.title,
        uploadedByAdminId: options.adminId,
      },
    });
    imported.push({ id: asset.id, url: publicImageUrl(storageKey), width: asset.width, height: asset.height, page });
  }
  return imported;
}
