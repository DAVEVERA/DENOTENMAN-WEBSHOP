import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const MB = 1024 * 1024;
export const COST_INVOICE_MAX_FILE_BYTES = 15 * MB;
export const COST_INVOICE_MAX_MULTIPART_BYTES = 17 * MB;
const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

const storage = new Storage();

export class CostInvoiceValidationError extends Error {}

export function invoiceUploadLengthError(
  value: string | null,
):
  | "CONTENT_LENGTH_REQUIRED"
  | "INVALID_CONTENT_LENGTH"
  | "INVOICE_TOO_LARGE"
  | null {
  if (!value?.trim()) return "CONTENT_LENGTH_REQUIRED";
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    return "INVALID_CONTENT_LENGTH";
  return parsed > COST_INVOICE_MAX_MULTIPART_BYTES ? "INVOICE_TOO_LARGE" : null;
}

export function invoiceFileSizeError(
  fileSize: number,
  contentLength: string | null,
): "EMPTY_INVOICE" | "INVOICE_TOO_LARGE" | "INVALID_CONTENT_LENGTH" | null {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return "EMPTY_INVOICE";
  if (fileSize > COST_INVOICE_MAX_FILE_BYTES) return "INVOICE_TOO_LARGE";
  const parsedContentLength = Number(contentLength);
  if (
    !Number.isSafeInteger(parsedContentLength) ||
    parsedContentLength < fileSize
  ) {
    return "INVALID_CONTENT_LENGTH";
  }
  return null;
}

export async function validateCostInvoice(
  bytes: Buffer,
  contentType: string,
): Promise<{
  contentType: string;
  fileSize: number;
  extension: string;
}> {
  const extension = ALLOWED_TYPES.get(contentType);
  if (!extension)
    throw new CostInvoiceValidationError("INVOICE_TYPE_NOT_ALLOWED");
  if (bytes.length <= 0) throw new CostInvoiceValidationError("EMPTY_INVOICE");
  if (bytes.length > COST_INVOICE_MAX_FILE_BYTES) {
    throw new CostInvoiceValidationError("INVOICE_TOO_LARGE");
  }

  if (contentType === "application/pdf") {
    if (bytes.length < 5 || bytes.toString("ascii", 0, 5) !== "%PDF-") {
      throw new CostInvoiceValidationError("INVALID_INVOICE_SIGNATURE");
    }
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
    }).catch(() => null);
    const pages = document?.getPageCount() ?? 0;
    if (pages < 1 || pages > 200)
      throw new CostInvoiceValidationError("INVALID_INVOICE_PDF");
  } else {
    if (!hasImageSignature(bytes, contentType)) {
      throw new CostInvoiceValidationError("INVALID_INVOICE_SIGNATURE");
    }
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .metadata()
      .catch(() => null);
    if (!metadata?.width || !metadata.height)
      throw new CostInvoiceValidationError("INVALID_INVOICE_IMAGE");
  }

  return { contentType, fileSize: bytes.length, extension };
}

function hasImageSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return (
    bytes.length >= 12 &&
    ["avif", "avis"].includes(bytes.toString("ascii", 8, 12))
  );
}

function invoiceBucket() {
  const bucketName = process.env.COST_INVOICE_GCS_BUCKET;
  if (!bucketName) throw new Error("COST_INVOICE_GCS_BUCKET is not configured");
  return storage.bucket(bucketName);
}

/** The UUID object name is independent of provider names, filenames and mutable labels. */
export function buildCostInvoiceStorageKey(extension: string): string {
  if (!/^(pdf|jpg|png|webp|avif)$/.test(extension))
    throw new Error("Invalid invoice extension");
  return `admin/cost-invoices/${randomUUID()}.${extension}`;
}

export async function saveImmutableCostInvoice(
  storageKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await invoiceBucket()
    .file(storageKey)
    .save(bytes, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType, cacheControl: "private, no-store" },
    });
}

export async function readCostInvoice(
  storageKey: string,
  expectedMaxBytes = COST_INVOICE_MAX_FILE_BYTES,
) {
  const file = invoiceBucket().file(storageKey);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (!Number.isSafeInteger(size) || size <= 0 || size > expectedMaxBytes) {
    throw new Error("Stored invoice exceeds the permitted read size");
  }
  const [bytes] = await file.download();
  if (bytes.length !== size || bytes.length > expectedMaxBytes) {
    throw new Error("Stored invoice size mismatch");
  }
  return bytes;
}

export async function deleteCostInvoiceObject(
  storageKey: string,
): Promise<void> {
  await invoiceBucket().file(storageKey).delete({ ignoreNotFound: true });
}
