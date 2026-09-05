import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import {
  BUSINESS_LOGO_MAX_FILE_BYTES,
  BUSINESS_LOGO_MAX_MULTIPART_BYTES,
  BusinessLogoValidationError,
  buildBusinessLogoStorageKey,
  businessLogoUploadLengthError,
  normalizeBusinessLogo,
} from "../lib/business-logo";

test("normalizes PNG, JPEG and WebP uploads to a bounded metadata-free WebP", async () => {
  for (const [contentType, format] of [["image/png", "png"], ["image/jpeg", "jpeg"], ["image/webp", "webp"]] as const) {
    const pipeline = sharp({ create: { width: 1_800, height: 900, channels: 4, background: "#c0a32e" } });
    const source = await pipeline[format]().toBuffer();
    const result = await normalizeBusinessLogo(source, contentType);
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(result.contentType, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1_200);
    assert.equal(metadata.height, 600);
    assert.ok(result.bytes.length <= BUSINESS_LOGO_MAX_FILE_BYTES);
  }
});

test("rejects MIME spoofing, corrupt images and unsafe dimensions", async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "white" } }).png().toBuffer();
  await assert.rejects(
    () => normalizeBusinessLogo(png, "image/jpeg"),
    (error: unknown) => error instanceof BusinessLogoValidationError && error.code === "INVALID_LOGO_SIGNATURE",
  );
  await assert.rejects(() => normalizeBusinessLogo(Buffer.from("not-an-image"), "image/png"));

  const tiny = await sharp({ create: { width: 15, height: 16, channels: 4, background: "white" } }).png().toBuffer();
  await assert.rejects(
    () => normalizeBusinessLogo(tiny, "image/png"),
    (error: unknown) => error instanceof BusinessLogoValidationError && error.code === "INVALID_LOGO_DIMENSIONS",
  );
});

test("uses randomized immutable keys within the authenticated account namespace", () => {
  const first = buildBusinessLogoStorageKey("account_123");
  const second = buildBusinessLogoStorageKey("account_123");
  assert.match(first, /^business-accounts\/account_123\/logos\/[a-f0-9-]+\.webp$/);
  assert.notEqual(first, second);
  assert.throws(() => buildBusinessLogoStorageKey("../another-account"));
});

test("rejects missing, invalid and oversized multipart lengths before body parsing", () => {
  assert.equal(businessLogoUploadLengthError(null), "CONTENT_LENGTH_REQUIRED");
  assert.equal(businessLogoUploadLengthError("0"), "INVALID_CONTENT_LENGTH");
  assert.equal(businessLogoUploadLengthError("1e3"), "INVALID_CONTENT_LENGTH");
  assert.equal(businessLogoUploadLengthError(String(BUSINESS_LOGO_MAX_MULTIPART_BYTES + 1)), "LOGO_TOO_LARGE");
  assert.equal(businessLogoUploadLengthError(String(BUSINESS_LOGO_MAX_MULTIPART_BYTES)), null);
});

test("logo route enforces origin, tenant CAS and post-commit old-object cleanup", async () => {
  const route = await readFile("app/api/business/account/logo/route.ts", "utf8");
  assert.match(route, /isSameOriginMutation/);
  assert.match(route, /session\.businessAccountId/);
  assert.match(route, /where: \{ id: account\.id, logoStorageKey: account\.logoStorageKey \}/);
  assert.ok(route.indexOf("databaseCommitted = true") < route.lastIndexOf("deleteProductAsset(account.logoStorageKey)"));
  assert.doesNotMatch(route, /form\?\.get\(["']storageKey["']\)/);
});

test("schema migration is nullable, additive and stores only the immutable object key", async () => {
  const [schema, migration] = await Promise.all([
    readFile("prisma/schema.prisma", "utf8"),
    readFile("prisma/migrations/20260905120000_add_business_account_logo/migration.sql", "utf8"),
  ]);
  assert.match(schema, /logoStorageKey\s+String\?\s+@unique/);
  assert.match(migration, /ADD COLUMN "logoStorageKey" TEXT/);
  assert.doesNotMatch(migration, /NOT NULL|DROP|DELETE FROM|UPDATE "BusinessAccount"/i);
});
