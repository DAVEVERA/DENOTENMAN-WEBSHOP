import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { hasValidImageSignature } from "../lib/storage";
import { ProductImageMigrationStorage } from "../lib/product-image-migration/storage";

loadEnvConfig(process.cwd());

const outputFields = [
  "masterWebpKey",
  "thumbnailWebpKey",
  "thumbnailAvifKey",
  "cardWebpKey",
  "cardAvifKey",
  "productWebpKey",
  "productAvifKey",
] as const;

type RecordedUpload = {
  key: string;
  generation: string;
  format: "webp" | "avif";
  name: "master" | "thumbnail" | "card" | "product";
  width: number;
  height: number;
  byteLength: number;
};

function recordedUploads(details: unknown): Map<string, RecordedUpload> {
  if (!details || typeof details !== "object" || !("uploads" in details)) {
    return new Map();
  }
  const uploads = (details as { uploads?: unknown }).uploads;
  if (!Array.isArray(uploads)) return new Map();
  return new Map(
    uploads
      .filter(
        (upload): upload is RecordedUpload =>
          Boolean(upload) &&
          typeof upload === "object" &&
          typeof (upload as RecordedUpload).key === "string" &&
          typeof (upload as RecordedUpload).generation === "string"
      )
      .map((upload) => [upload.key, upload])
  );
}

export function parseRunId(arguments_: string[]): string {
  const values = arguments_
    .filter((argument) => argument.startsWith("--run-id="))
    .map((argument) => argument.slice("--run-id=".length));
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{1,160}$/.test(values[0])) {
    throw new Error("Provide exactly one safe --run-id=<id>");
  }
  if (arguments_.length !== 1) throw new Error("Unknown verification option");
  return values[0];
}

export async function verifyProductImageMigration(runId: string): Promise<{
  runId: string;
  records: number;
  success: number;
  needsManualReview: number;
  failed: number;
  verifiedDerivedObjects: number;
  originalsUnchanged: boolean;
}> {
  const storage = new ProductImageMigrationStorage();
  const records = await prisma.productImageProcessing.findMany({
    where: { runId },
    orderBy: { productImageId: "asc" },
    include: {
      productImage: { select: { id: true, productId: true, storageKey: true } },
    },
  });
  if (records.length === 0) throw new Error(`No processing records found for run ${runId}`);

  let verifiedDerivedObjects = 0;
  for (const record of records) {
    if (record.productImage.storageKey !== record.originalStorageKey) {
      throw new Error(`Original storage key changed for image ${record.productImageId}`);
    }
    const source = await storage.inspectSource(record.originalStorageKey);
    if (!record.sourceGeneration || source.generation !== record.sourceGeneration) {
      throw new Error(`Original object generation changed for image ${record.productImageId}`);
    }
    const keys = outputFields.map((field) => record[field]);
    if (record.status === "SUCCEEDED") {
      if (keys.some((key) => !key)) {
        throw new Error(`Successful image ${record.productImageId} has an incomplete output set`);
      }
      const uploads = recordedUploads(record.details);
      if (uploads.size !== outputFields.length) {
        throw new Error(`Successful image ${record.productImageId} lacks upload-generation evidence`);
      }
      const expectedPrefix = `products/${record.productImage.productId}/derived/${record.processingVersion}/${record.productImageId}/${record.runId}/`;
      for (const key of keys) {
        if (!key || !key.startsWith(expectedPrefix) || key === record.originalStorageKey) {
          throw new Error(`Successful image ${record.productImageId} has an unsafe output key`);
        }
        const recorded = uploads.get(key);
        if (!recorded || !/^\d+$/.test(recorded.generation)) {
          throw new Error(`Derived object ${key} lacks a safe recorded generation`);
        }
        const stored = await storage.downloadSource(key, 64 * 1024 * 1024);
        if (stored.generation !== recorded.generation) {
          throw new Error(`Derived object ${key} generation no longer matches the ledger`);
        }
        const expectedContentType = recorded.format === "webp" ? "image/webp" : "image/avif";
        if (
          stored.contentType !== expectedContentType ||
          stored.bytes.length !== recorded.byteLength ||
          !hasValidImageSignature(stored.bytes, expectedContentType)
        ) {
          throw new Error(`Derived object ${key} failed content verification`);
        }
        const metadata = await sharp(stored.bytes, { failOn: "error" }).metadata();
        const decodedFormat = recorded.format === "avif" ? "heif" : recorded.format;
        if (
          metadata.format !== decodedFormat ||
          metadata.width !== recorded.width ||
          metadata.height !== recorded.height ||
          metadata.width !== metadata.height
        ) {
          throw new Error(`Derived object ${key} failed decode or dimension verification`);
        }
        verifiedDerivedObjects += 1;
      }
    } else if (keys.some((key) => key !== null)) {
      throw new Error(`Non-success image ${record.productImageId} unexpectedly references outputs`);
    }
  }

  return {
    runId,
    records: records.length,
    success: records.filter((record) => record.status === "SUCCEEDED").length,
    needsManualReview: records.filter((record) => record.status === "NEEDS_MANUAL_REVIEW").length,
    failed: records.filter((record) => record.status === "FAILED").length,
    verifiedDerivedObjects,
    originalsUnchanged: true,
  };
}

export async function main(): Promise<void> {
  const result = await verifyProductImageMigration(parseRunId(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
