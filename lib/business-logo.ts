import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MB = 1024 * 1024;

export const BUSINESS_LOGO_MAX_FILE_BYTES = 2 * MB;
export const BUSINESS_LOGO_MAX_MULTIPART_BYTES = BUSINESS_LOGO_MAX_FILE_BYTES + 256 * 1024;
export const BUSINESS_LOGO_MAX_SOURCE_DIMENSION = 4_096;
export const BUSINESS_LOGO_MAX_SOURCE_PIXELS = 16_000_000;
export const BUSINESS_LOGO_OUTPUT_WIDTH = 1_200;
export const BUSINESS_LOGO_OUTPUT_HEIGHT = 600;

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

export type BusinessLogoContentType = "image/jpeg" | "image/png" | "image/webp";

export class BusinessLogoValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BusinessLogoValidationError";
  }
}

export function businessLogoUploadLengthError(value: string | null):
  | "CONTENT_LENGTH_REQUIRED"
  | "INVALID_CONTENT_LENGTH"
  | "LOGO_TOO_LARGE"
  | null {
  if (!value?.trim()) return "CONTENT_LENGTH_REQUIRED";
  if (!/^[1-9]\d*$/.test(value.trim())) return "INVALID_CONTENT_LENGTH";
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return "INVALID_CONTENT_LENGTH";
  return parsed > BUSINESS_LOGO_MAX_MULTIPART_BYTES ? "LOGO_TOO_LARGE" : null;
}

export function buildBusinessLogoStorageKey(accountId: string): string {
  const safeAccountId = accountId.trim();
  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(safeAccountId)) {
    throw new Error("Invalid business account id");
  }
  return `business-accounts/${safeAccountId}/logos/${randomUUID()}.webp`;
}

function hasMatchingSignature(bytes: Buffer, contentType: BusinessLogoContentType): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 4
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[2] === 0xff
      && bytes[bytes.length - 2] === 0xff
      && bytes[bytes.length - 1] === 0xd9;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
}

/**
 * Fully decodes an upload and re-encodes it as a bounded, metadata-free WebP.
 * The browser MIME value is never treated as proof of the file's contents.
 */
export async function normalizeBusinessLogo(
  bytes: Buffer,
  contentType: string,
): Promise<{ bytes: Buffer; contentType: "image/webp"; width: number; height: number }> {
  const expectedFormat = ALLOWED_TYPES.get(contentType as BusinessLogoContentType);
  if (!expectedFormat) throw new BusinessLogoValidationError("LOGO_TYPE_NOT_ALLOWED");
  if (bytes.length <= 0) throw new BusinessLogoValidationError("EMPTY_LOGO");
  if (bytes.length > BUSINESS_LOGO_MAX_FILE_BYTES) {
    throw new BusinessLogoValidationError("LOGO_TOO_LARGE");
  }
  if (!hasMatchingSignature(bytes, contentType as BusinessLogoContentType)) {
    throw new BusinessLogoValidationError("INVALID_LOGO_SIGNATURE");
  }

  const input = sharp(bytes, {
    failOn: "error",
    limitInputPixels: BUSINESS_LOGO_MAX_SOURCE_PIXELS,
    sequentialRead: true,
  });
  const metadata = await input.metadata().catch(() => null);
  if (
    !metadata?.width
    || !metadata.height
    || metadata.format !== expectedFormat
    || (metadata.pages ?? 1) !== 1
  ) {
    throw new BusinessLogoValidationError("INVALID_LOGO_IMAGE");
  }
  if (
    metadata.width < 16
    || metadata.height < 16
    || metadata.width > BUSINESS_LOGO_MAX_SOURCE_DIMENSION
    || metadata.height > BUSINESS_LOGO_MAX_SOURCE_DIMENSION
    || metadata.width * metadata.height > BUSINESS_LOGO_MAX_SOURCE_PIXELS
  ) {
    throw new BusinessLogoValidationError("INVALID_LOGO_DIMENSIONS");
  }

  const normalized = await input
    .rotate()
    .resize({
      width: BUSINESS_LOGO_OUTPUT_WIDTH,
      height: BUSINESS_LOGO_OUTPUT_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90, alphaQuality: 95, effort: 4 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!normalized?.data.length || normalized.data.length > BUSINESS_LOGO_MAX_FILE_BYTES) {
    throw new BusinessLogoValidationError("LOGO_NORMALIZATION_FAILED");
  }

  return {
    bytes: normalized.data,
    contentType: "image/webp",
    width: normalized.info.width,
    height: normalized.info.height,
  };
}
