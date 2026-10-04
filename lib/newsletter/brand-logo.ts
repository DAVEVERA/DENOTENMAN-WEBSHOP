import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { saveImmutableProductAsset } from "@/lib/storage";

export type BrandLogoVariant = "dark" | "light";

const LOGO_WIDTH = 720;

/**
 * Renders a PNG from an SVG logo: email clients do not show SVG. "light" turns every
 * visible pixel white for dark headers, keeping the shape through the alpha channel.
 */
export async function renderBrandLogoPng(svg: Buffer, variant: BrandLogoVariant): Promise<Buffer> {
  const dark = await sharp(svg, { density: 300 }).resize({ width: LOGO_WIDTH }).png().toBuffer();
  if (variant === "dark") return dark;
  const { width = LOGO_WIDTH, height = 1 } = await sharp(dark).metadata();
  const alpha = await sharp(dark).ensureAlpha().extractChannel("alpha").toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toBuffer();
}

function isAlreadyStored(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 412;
}

/** Stores the De Notenman wordmark as a PNG once per version and returns its public URL. */
export async function brandLogoUrl(variant: BrandLogoVariant): Promise<string> {
  const cdn = process.env.CDN_BASE_URL?.replace(/\/+$/u, "");
  if (!cdn || !process.env.GCS_BUCKET) throw new Error("STORAGE_NOT_CONFIGURED");
  const svg = await readFile(path.join(process.cwd(), "public", "brand", "logo-wordmark.svg"));
  const version = createHash("sha256").update(svg).digest("hex").slice(0, 12);
  const key = `newsletter/brand/logo-wordmark-${variant}-${version}.png`;
  try {
    await saveImmutableProductAsset(key, await renderBrandLogoPng(svg, variant), "image/png");
  } catch (error) {
    if (!isAlreadyStored(error)) throw error;
  }
  return `${cdn}/${key}`;
}
