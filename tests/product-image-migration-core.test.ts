import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import type { Storage } from "@google-cloud/storage";
import type { PrismaClient } from "@prisma/client";
import { defaultImageMigrationConfig } from "../lib/product-image-migration/config";
import { calculateCenteredSquareCrop } from "../lib/product-image-migration/crop";
import {
  detectProductCircle,
  normalizeProductImage,
} from "../lib/product-image-migration/detection";
import {
  shouldPreserveSuccessfulRecord,
  shouldSkipProcessedImage,
  runProductImageMigration,
} from "../lib/product-image-migration/runner";
import {
  buildDerivedImagePrefix,
  buildDerivedImageKey,
  ProductImageMigrationStorage,
} from "../lib/product-image-migration/storage";
import { generateProductImageVariants } from "../lib/product-image-migration/variants";

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("calculates only a centered square crop that retains the configured margin", () => {
  assert.deepEqual(
    calculateCenteredSquareCrop(
      1_000,
      1_000,
      { centerX: 500, centerY: 500, radius: 350 },
      0.1
    ),
    { ok: true, crop: { left: 114, top: 114, size: 771 } }
  );
  assert.deepEqual(
    calculateCenteredSquareCrop(
      1_000,
      1_000,
      { centerX: 180, centerY: 500, radius: 220 },
      0.12
    ),
    { ok: false, reason: "insufficient_source_margin" }
  );
});

test("detects a clear synthetic circle and rejects no-circle input", async () => {
  const clearCircle = await sharp({
    create: { width: 800, height: 800, channels: 4, background: "white" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><circle cx="360" cy="420" r="250" fill="#8d5c2f" stroke="#24160c" stroke-width="10"/></svg>'
        ),
      },
    ])
    .png()
    .toBuffer();
  const normalized = await normalizeProductImage(clearCircle, defaultImageMigrationConfig);
  const detected = await detectProductCircle(
    normalized.bytes,
    normalized.width,
    normalized.height,
    defaultImageMigrationConfig
  );
  assert.equal(detected.status, "detected");
  if (detected.status === "detected") {
    assert.ok(Math.abs(detected.circle.centerX - 360) < 15);
    assert.ok(Math.abs(detected.circle.centerY - 420) < 15);
    assert.ok(Math.abs(detected.circle.radius - 250) < 20);
  }

  const blank = await sharp({
    create: { width: 800, height: 800, channels: 4, background: "white" },
  }).png().toBuffer();
  const blankResult = await detectProductCircle(
    blank,
    800,
    800,
    defaultImageMigrationConfig
  );
  assert.equal(blankResult.status, "needs_manual_review");
  if (blankResult.status === "needs_manual_review") {
    assert.equal(blankResult.reason, "no_circle");
  }
});

test("routes multiple similarly strong circles to manual review", async () => {
  const source = await sharp({
    create: { width: 800, height: 800, channels: 4, background: "white" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><circle cx="220" cy="400" r="150" fill="#8d5c2f" stroke="#24160c" stroke-width="10"/><circle cx="580" cy="400" r="150" fill="#8d5c2f" stroke="#24160c" stroke-width="10"/></svg>'
        ),
      },
    ])
    .png()
    .toBuffer();
  const result = await detectProductCircle(source, 800, 800, {
    ...defaultImageMigrationConfig,
    confidenceThreshold: 0.4,
    ambiguityDelta: 0.2,
  });
  assert.equal(result.status, "needs_manual_review");
  if (result.status === "needs_manual_review") {
    assert.equal(result.reason, "ambiguous_circles");
    assert.ok(result.candidates.length >= 2);
  }
});

test("normalizes EXIF orientation before detection and cropping", async () => {
  const oriented = await sharp({
    create: { width: 120, height: 240, channels: 3, background: "white" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const normalized = await normalizeProductImage(oriented, defaultImageMigrationConfig);
  assert.equal(normalized.width, 240);
  assert.equal(normalized.height, 120);
});

test("generates WebP and AVIF variants without changing or enlarging the source", async () => {
  const source = await sharp({
    create: { width: 600, height: 600, channels: 4, background: { r: 120, g: 80, b: 40, alpha: 0.7 } },
  }).png().toBuffer();
  const originalHash = hash(source);
  const generated = await generateProductImageVariants(
    source,
    { left: 50, top: 50, size: 500 },
    defaultImageMigrationConfig
  );
  assert.equal(generated.length, 7);
  assert.deepEqual(
    generated.map((image) => `${image.name}.${image.format}`),
    [
      "master.webp",
      "thumbnail.webp",
      "thumbnail.avif",
      "card.webp",
      "card.avif",
      "product.webp",
      "product.avif",
    ]
  );
  assert.equal(hash(source), originalHash);
  for (const image of generated) {
    assert.equal(image.width, image.height);
    if (image.targetSize) assert.ok(image.width <= image.targetSize);
    assert.ok(image.width <= 500, `${image.name}.${image.format} was enlarged`);
    const { data, info } = await sharp(image.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    assert.ok(
      data.some((value, index) => index % 4 === 3 && value < 255),
      `${image.name}.${image.format} lost source transparency`
    );
  }
});

test("derived keys use stable IDs, a version and a run without relying on a slug", () => {
  const prefix = buildDerivedImagePrefix({
    productId: "product_123",
    imageId: "image_456",
    processingVersion: "circle-center-v1",
    runId: "20260820-deadbeef",
  });
  assert.equal(
    prefix,
    "products/product_123/derived/circle-center-v1/image_456/20260820-deadbeef"
  );
  assert.equal(
    buildDerivedImageKey(prefix, {
      name: "thumbnail",
      format: "webp",
      bytes: Buffer.alloc(0),
      width: 400,
      height: 400,
      targetSize: 400,
    }),
    `${prefix}/thumbnail.webp`
  );
});

test("resume is idempotent only for the same original key and object generation", () => {
  const existing = {
    status: "SUCCEEDED",
    originalStorageKey: "products/source.jpg",
    sourceGeneration: "1234567890123456789",
  };
  assert.equal(
    shouldSkipProcessedImage(existing, "products/source.jpg", "1234567890123456789", false),
    true
  );
  assert.equal(
    shouldSkipProcessedImage(existing, "products/source.jpg", "new-generation", false),
    false
  );
  assert.equal(
    shouldSkipProcessedImage(existing, "products/source.jpg", "1234567890123456789", true),
    false
  );
});

test("a failed forced attempt preserves the prior success for the same source generation", () => {
  const existing = {
    status: "SUCCEEDED",
    originalStorageKey: "products/source.jpg",
    sourceGeneration: "123",
  };
  assert.equal(
    shouldPreserveSuccessfulRecord(existing, true, "products/source.jpg", "123"),
    true
  );
  assert.equal(
    shouldPreserveSuccessfulRecord(existing, true, "products/source.jpg", "456"),
    false
  );
  assert.equal(
    shouldPreserveSuccessfulRecord(existing, false, "products/source.jpg", "123"),
    false
  );
});

test("downloads and cleanup are scoped to the exact GCS object generation", async () => {
  const calls: Array<{ key: string; generation?: string; operation: string }> = [];
  const fakeStorage = {
    bucket: () => ({
      file: (key: string, options?: { generation?: string }) => ({
        getMetadata: async () => {
          calls.push({ key, generation: options?.generation, operation: "metadata" });
          return [{ size: "3", generation: "17", contentType: "image/webp" }];
        },
        download: async () => {
          calls.push({ key, generation: options?.generation, operation: "download" });
          return [Buffer.from([1, 2, 3])];
        },
        delete: async () => {
          calls.push({ key, generation: options?.generation, operation: "delete" });
          return [];
        },
      }),
    }),
  };
  const gateway = new ProductImageMigrationStorage(
    "test-bucket",
    fakeStorage as unknown as Storage
  );
  await gateway.downloadSource("products/source.webp", 100);
  await gateway.removeDerived("products/p/derived/v1/i/run/thumbnail.webp", "23");
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "download" &&
        call.key === "products/source.webp" &&
        call.generation === "17"
    )
  );
  assert.ok(
    calls.some(
      (call) =>
        call.operation === "delete" &&
        call.generation === "23"
    )
  );
  await assert.rejects(() =>
    gateway.removeDerived("products/p/derived/v1/i/run/thumbnail.webp", "latest")
  );
});

test("dry-run completes analysis without invoking storage or database writes", async () => {
  const source = await sharp({
    create: { width: 800, height: 800, channels: 4, background: "white" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><circle cx="400" cy="400" r="250" fill="#8d5c2f" stroke="#24160c" stroke-width="10"/></svg>'
        ),
      },
    ])
    .png()
    .toBuffer();
  let storageWrites = 0;
  let databaseWrites = 0;
  const fakePrisma = {
    product: { findMany: async () => [{ id: "product_123" }] },
    productImage: {
      findMany: async () => [
        {
          id: "image_456",
          productId: "product_123",
          storageKey: "products/source.png",
          alt: null,
          sortOrder: 0,
          isPrimary: true,
          product: {
            id: "product_123",
            sku: "SKU-123",
            translations: [{ name: "Testproduct", locale: "nl" }],
          },
        },
      ],
    },
    productImageProcessing: {
      findUnique: async () => {
        databaseWrites += 1;
        throw new Error("dry-run attempted a processing-ledger read/write");
      },
      upsert: async () => {
        databaseWrites += 1;
        throw new Error("dry-run attempted a database write");
      },
    },
    $transaction: async () => {
      databaseWrites += 1;
      throw new Error("dry-run attempted a transaction");
    },
  };
  const fakeStorage = {
    inspectSource: async () => ({
      generation: "17",
      contentType: "image/png",
      size: source.length,
    }),
    downloadSource: async () => ({
      bytes: source,
      generation: "17",
      contentType: "image/png",
      size: source.length,
    }),
    uploadDerived: async () => {
      storageWrites += 1;
      throw new Error("dry-run attempted an upload");
    },
    removeDerived: async () => {
      storageWrites += 1;
      throw new Error("dry-run attempted a delete");
    },
  };
  const previousCdn = process.env.CDN_BASE_URL;
  process.env.CDN_BASE_URL = "https://images.example.test";
  try {
    const report = await runProductImageMigration(
      {
        prisma: fakePrisma as unknown as PrismaClient,
        storage: fakeStorage as unknown as ProductImageMigrationStorage,
        config: defaultImageMigrationConfig,
      },
      {
        dryRun: true,
        limit: 10,
        resume: false,
        force: false,
        runId: "dry-run-test",
      }
    );
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0].status, "success");
    assert.equal(storageWrites, 0);
    assert.equal(databaseWrites, 0);
  } finally {
    if (previousCdn === undefined) delete process.env.CDN_BASE_URL;
    else process.env.CDN_BASE_URL = previousCdn;
  }
});
