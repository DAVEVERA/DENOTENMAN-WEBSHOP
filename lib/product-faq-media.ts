import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import type { ProductFaqMediaType } from "@prisma/client";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const PDF_TYPE = "application/pdf";
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MB = 1024 * 1024;
export const FAQ_MAX_MULTIPART_BYTES = 52 * MB;

export type FaqUploadLengthError = "CONTENT_LENGTH_REQUIRED" | "INVALID_CONTENT_LENGTH" | "MEDIA_TOO_LARGE";

export function faqUploadLengthError(value: string | null): FaqUploadLengthError | null {
  if (value === null || value.trim() === "") return "CONTENT_LENGTH_REQUIRED";
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return "INVALID_CONTENT_LENGTH";
  return parsed > FAQ_MAX_MULTIPART_BYTES ? "MEDIA_TOO_LARGE" : null;
}

export type ValidatedFaqMedia = {
  contentType: string;
  fileSize: number;
  width?: number;
  height?: number;
  pageCount?: number;
  durationMs?: number;
  extension: string;
};

export class FaqMediaValidationError extends Error {}

function hasImageSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return bytes.length >= 12 && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
}

function extensionFor(contentType: string): string {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "application/pdf": "pdf", "video/mp4": "mp4", "video/webm": "webm" } as Record<string, string>)[contentType] ?? "bin";
}

export function isFaqMediaTypeAllowed(type: ProductFaqMediaType, contentType: string): boolean {
  if (type === "IMAGE") return IMAGE_TYPES.has(contentType);
  if (type === "INFOGRAPHIC") return IMAGE_TYPES.has(contentType) || contentType === PDF_TYPE;
  return IMAGE_TYPES.has(contentType) || contentType === PDF_TYPE || VIDEO_TYPES.has(contentType);
}

export function faqMediaMaxBytes(type: ProductFaqMediaType, contentType: string): number | null {
  if (!isFaqMediaTypeAllowed(type, contentType)) return null;
  if (IMAGE_TYPES.has(contentType)) return (type === "IMAGE" ? 8 : 15) * MB;
  return contentType === PDF_TYPE ? 15 * MB : 50 * MB;
}

type BinaryBox = { type: string; dataStart: number; end: number };

function parseIsoBoxes(bytes: Buffer, start: number, end: number): BinaryBox[] {
  const boxes: BinaryBox[] = [];
  let offset = start;
  while (offset < end) {
    if (boxes.length >= 10_000 || offset + 8 > end) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
    const size32 = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size32;
    if (size32 === 1) {
      if (offset + 16 > end) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
      const extended = bytes.readBigUInt64BE(offset + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
      boxSize = Number(extended);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }
    if (boxSize < headerSize || offset + boxSize > end) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
    boxes.push({ type, dataStart: offset + headerSize, end: offset + boxSize });
    offset += boxSize;
  }
  return boxes;
}

function parseMp4Duration(bytes: Buffer): number {
  const topLevel = parseIsoBoxes(bytes, 0, bytes.length);
  const ftyp = topLevel.find((box) => box.type === "ftyp");
  const moov = topLevel.find((box) => box.type === "moov");
  const hasMediaData = topLevel.some((box) => box.type === "mdat");
  if (!ftyp || ftyp.dataStart + 8 > ftyp.end || !moov || !hasMediaData) {
    throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  }
  const majorBrand = bytes.toString("ascii", ftyp.dataStart, ftyp.dataStart + 4);
  if (!/^[\x20-\x7e]{4}$/.test(majorBrand)) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  const mvhd = parseIsoBoxes(bytes, moov.dataStart, moov.end).find((box) => box.type === "mvhd");
  if (!mvhd) throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
  const version = bytes[mvhd.dataStart];
  const timeScaleOffset = mvhd.dataStart + (version === 1 ? 20 : 12);
  const durationOffset = mvhd.dataStart + (version === 1 ? 24 : 16);
  const durationBytes = version === 1 ? 8 : 4;
  if ((version !== 0 && version !== 1) || durationOffset + durationBytes > mvhd.end) {
    throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
  }
  const timeScale = bytes.readUInt32BE(timeScaleOffset);
  const duration = version === 1 ? Number(bytes.readBigUInt64BE(durationOffset)) : bytes.readUInt32BE(durationOffset);
  const durationMs = Math.round((duration / timeScale) * 1000);
  if (!timeScale || !Number.isSafeInteger(duration) || !Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
  }
  return durationMs;
}

type EbmlVint = { length: number; value: number; unknown: boolean };

function readEbmlVint(bytes: Buffer, offset: number, forId: boolean): EbmlVint {
  if (offset >= bytes.length) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  const first = bytes[offset];
  let length = 1;
  let marker = 0x80;
  while (length <= 8 && (first & marker) === 0) { length += 1; marker >>= 1; }
  if (length > (forId ? 4 : 8) || offset + length > bytes.length) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  let value = forId ? first : first & (marker - 1);
  let unknown = !forId && (first & (marker - 1)) === marker - 1;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index];
    if (!forId && bytes[offset + index] !== 0xff) unknown = false;
  }
  if (!Number.isSafeInteger(value)) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  return { length, value, unknown };
}

type EbmlElement = { id: number; dataStart: number; end: number; unknownSize: boolean };

function parseEbmlElements(bytes: Buffer, start: number, end: number, allowUnknownSegment = false): EbmlElement[] {
  const elements: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    if (elements.length >= 10_000) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
    const id = readEbmlVint(bytes, offset, true);
    const size = readEbmlVint(bytes, offset + id.length, false);
    const dataStart = offset + id.length + size.length;
    const isSegment = id.value === 0x18538067;
    if (size.unknown && !(allowUnknownSegment && isSegment)) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
    const elementEnd = size.unknown ? end : dataStart + size.value;
    if (elementEnd < dataStart || elementEnd > end) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
    elements.push({ id: id.value, dataStart, end: elementEnd, unknownSize: size.unknown });
    offset = elementEnd;
  }
  return elements;
}

function parseWebmDuration(bytes: Buffer): number {
  const topLevel = parseEbmlElements(bytes, 0, bytes.length, true);
  const header = topLevel.find((element) => element.id === 0x1a45dfa3);
  const segment = topLevel.find((element) => element.id === 0x18538067);
  if (!header || !segment) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  const headerElements = parseEbmlElements(bytes, header.dataStart, header.end);
  const docType = headerElements.find((element) => element.id === 0x4282);
  if (!docType || bytes.toString("ascii", docType.dataStart, docType.end).toLowerCase() !== "webm") {
    throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  }
  const segmentElements = parseEbmlElements(bytes, segment.dataStart, segment.end);
  const info = segmentElements.find((element) => element.id === 0x1549a966);
  const hasTracks = segmentElements.some((element) => element.id === 0x1654ae6b);
  const hasCluster = segmentElements.some((element) => element.id === 0x1f43b675);
  if (!info || !hasTracks || !hasCluster) throw new FaqMediaValidationError("INVALID_VIDEO_CONTAINER");
  const infoElements = parseEbmlElements(bytes, info.dataStart, info.end);
  const scaleElement = infoElements.find((element) => element.id === 0x2ad7b1);
  const durationElement = infoElements.find((element) => element.id === 0x4489);
  let timecodeScale = 1_000_000;
  if (scaleElement) {
    const length = scaleElement.end - scaleElement.dataStart;
    if (length < 1 || length > 8) throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
    timecodeScale = 0;
    for (let offset = scaleElement.dataStart; offset < scaleElement.end; offset += 1) timecodeScale = timecodeScale * 256 + bytes[offset];
  }
  if (!durationElement) throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
  const durationLength = durationElement.end - durationElement.dataStart;
  const duration = durationLength === 4
    ? bytes.readFloatBE(durationElement.dataStart)
    : durationLength === 8
      ? bytes.readDoubleBE(durationElement.dataStart)
      : Number.NaN;
  const durationMs = Math.round(duration * timecodeScale / 1_000_000);
  if (!Number.isFinite(duration) || !Number.isSafeInteger(durationMs) || durationMs <= 0) {
    throw new FaqMediaValidationError("INVALID_VIDEO_METADATA");
  }
  return durationMs;
}

export async function validateFaqMedia(bytes: Buffer, type: ProductFaqMediaType, contentType: string): Promise<ValidatedFaqMedia> {
  if (!isFaqMediaTypeAllowed(type, contentType) || bytes.length <= 0) throw new FaqMediaValidationError("MEDIA_TYPE_NOT_ALLOWED");
  const maxBytes = faqMediaMaxBytes(type, contentType);
  if (!maxBytes) throw new FaqMediaValidationError("MEDIA_TYPE_NOT_ALLOWED");
  if (bytes.length > maxBytes) throw new FaqMediaValidationError("MEDIA_TOO_LARGE");

  if (IMAGE_TYPES.has(contentType)) {
    if (!hasImageSignature(bytes, contentType)) throw new FaqMediaValidationError("INVALID_MEDIA_SIGNATURE");
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
    if (!metadata?.width || !metadata.height) throw new FaqMediaValidationError("INVALID_IMAGE");
    return { contentType, fileSize: bytes.length, width: metadata.width, height: metadata.height, extension: extensionFor(contentType) };
  }
  if (contentType === PDF_TYPE) {
    if (bytes.length < 5 || bytes.toString("ascii", 0, 5) !== "%PDF-") throw new FaqMediaValidationError("INVALID_MEDIA_SIGNATURE");
    const document = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => null);
    const pageCount = document?.getPageCount() ?? 0;
    if (pageCount < 1 || pageCount > 50) throw new FaqMediaValidationError("INVALID_PDF_PAGE_COUNT");
    return { contentType, fileSize: bytes.length, pageCount, extension: "pdf" };
  }
  const durationMs = contentType === "video/mp4" ? parseMp4Duration(bytes) : parseWebmDuration(bytes);
  return { contentType, fileSize: bytes.length, durationMs, extension: extensionFor(contentType) };
}
