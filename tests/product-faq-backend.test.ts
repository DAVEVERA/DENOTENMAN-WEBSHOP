import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { isSameOriginMutation } from "../lib/admin-request-security";
import { buildProductAssetKey } from "../lib/storage";
import {
  faqCreateInputSchema,
  hasPublishableFaqTranslation,
  sanitizeFaqHtml,
} from "../lib/product-faq-schema";
import {
  FAQ_MAX_MULTIPART_BYTES,
  faqUploadLengthError,
  validateFaqMedia,
} from "../lib/product-faq-media";
import {
  assertFaqMutationMatch,
  buildFaqMutationRequestHash,
} from "../lib/product-faq-db";

function isoBox(type: string, payload: Buffer): Buffer {
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(result.length, 0);
  result.write(type, 4, 4, "ascii");
  payload.copy(result, 8);
  return result;
}

function validMp4Fixture(): Buffer {
  const ftyp = isoBox("ftyp", Buffer.from("isom\u0000\u0000\u0000\u0000isommp42", "binary"));
  const mvhdPayload = Buffer.alloc(20);
  mvhdPayload.writeUInt32BE(1_000, 12);
  mvhdPayload.writeUInt32BE(2_500, 16);
  const moov = isoBox("moov", isoBox("mvhd", mvhdPayload));
  const mdat = isoBox("mdat", Buffer.from([0]));
  return Buffer.concat([ftyp, moov, mdat]);
}

function ebmlElement(id: number[], payload: Buffer): Buffer {
  if (payload.length >= 127) throw new Error("Test-EBML payload is te groot voor een eenbyte-VINT.");
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | payload.length]), payload]);
}

function validWebmFixture(): Buffer {
  const header = ebmlElement([0x1a, 0x45, 0xdf, 0xa3], ebmlElement([0x42, 0x82], Buffer.from("webm", "ascii")));
  const scale = ebmlElement([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]));
  const durationValue = Buffer.alloc(8);
  durationValue.writeDoubleBE(2_500);
  const duration = ebmlElement([0x44, 0x89], durationValue);
  const info = ebmlElement([0x15, 0x49, 0xa9, 0x66], Buffer.concat([scale, duration]));
  const tracks = ebmlElement([0x16, 0x54, 0xae, 0x6b], Buffer.alloc(0));
  const cluster = ebmlElement([0x1f, 0x43, 0xb6, 0x75], Buffer.alloc(0));
  const segment = ebmlElement([0x18, 0x53, 0x80, 0x67], Buffer.concat([info, tracks, cluster]));
  return Buffer.concat([header, segment]);
}

test("FAQ rich text strips scripts, handlers and unsafe protocols", () => {
  const clean = sanitizeFaqHtml('<p onclick="bad()">Veilig <strong>antwoord</strong><script>bad()</script><a href="javascript:bad()">link</a></p>');
  assert.match(clean, /<strong>antwoord<\/strong>/);
  assert.doesNotMatch(clean, /script|onclick|javascript/i);
});

test("FAQ input enforces unique locales and requires complete translation pairs", () => {
  const base = { expectedRevision: 0, idempotencyKey: "request-123", placement: "BELOW_PRODUCT_DETAILS" as const };
  assert.equal(faqCreateInputSchema.safeParse({ ...base, translations: [{ locale: "nl", question: "Vraag", answerHtml: "" }] }).success, false);
  assert.equal(faqCreateInputSchema.safeParse({ ...base, translations: [
    { locale: "nl", question: "Vraag", answerHtml: "<p>Antwoord</p>" },
    { locale: "nl", question: "Vraag 2", answerHtml: "<p>Antwoord 2</p>" },
  ] }).success, false);
  assert.equal(hasPublishableFaqTranslation([{ question: "Vraag", answerHtml: "<p>Antwoord</p>" }]), true);
});

test("product asset keys use immutable product identity and reject traversal", () => {
  const key = buildProductAssetKey("product_123", "faq/item_456", "illustratie.webp");
  assert.match(key, /^products\/by-id\/product_123\/faq\/item_456\/[a-f0-9-]+\.webp$/);
  assert.throws(() => buildProductAssetKey("product_123", "faq", "../secret.pdf"));
});

test("same-origin mutation guard validates effective proxy origin", () => {
  const ok = new NextRequest("https://internal/api/admin", { method: "POST", headers: { origin: "https://admin.example.nl", "x-forwarded-host": "admin.example.nl", "x-forwarded-proto": "https" } });
  const bad = new NextRequest("https://internal/api/admin", { method: "POST", headers: { origin: "https://attacker.example", "x-forwarded-host": "admin.example.nl", "x-forwarded-proto": "https" } });
  assert.equal(isSameOriginMutation(ok), true);
  assert.equal(isSameOriginMutation(bad), false);
});

test("FAQ media validates signatures and semantic type restrictions", async () => {
  const png = await sharp({ create: { width: 4, height: 3, channels: 4, background: "white" } }).png().toBuffer();
  const image = await validateFaqMedia(png, "IMAGE", "image/png");
  assert.deepEqual({ width: image.width, height: image.height, extension: image.extension }, { width: 4, height: 3, extension: "png" });

  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage();
  const pdf = Buffer.from(await pdfDocument.save());
  assert.equal((await validateFaqMedia(pdf, "INFOGRAPHIC", "application/pdf")).pageCount, 1);
  await assert.rejects(() => validateFaqMedia(pdf, "IMAGE", "application/pdf"), /MEDIA_TYPE_NOT_ALLOWED/);
  await assert.rejects(() => validateFaqMedia(Buffer.from("not a png"), "IMAGE", "image/png"), /INVALID_MEDIA_SIGNATURE/);
});

test("FAQ mutation idempotency binds operation, target and canonical payload", () => {
  const first = buildFaqMutationRequestHash("SAVE_DRAFT", "faq-a", { placement: "PAGE_BOTTOM", version: 2 });
  const reorderedKeys = buildFaqMutationRequestHash("SAVE_DRAFT", "faq-a", { version: 2, placement: "PAGE_BOTTOM" });
  const changedPayload = buildFaqMutationRequestHash("SAVE_DRAFT", "faq-a", { version: 3, placement: "PAGE_BOTTOM" });
  assert.equal(first, reorderedKeys);
  assert.notEqual(first, changedPayload);
  assert.doesNotThrow(() => assertFaqMutationMatch({ operation: "SAVE_DRAFT", requestHash: first, itemId: "faq-a" }, "SAVE_DRAFT", first, "faq-a"));
  assert.throws(() => assertFaqMutationMatch({ operation: "SAVE_DRAFT", requestHash: first, itemId: "faq-a" }, "SAVE_DRAFT", first, "faq-b"), /IDEMPOTENCY_CONFLICT/);
  assert.throws(() => assertFaqMutationMatch({ operation: "SAVE_DRAFT", requestHash: first, itemId: "faq-a" }, "SAVE_DRAFT", changedPayload, "faq-a"), /IDEMPOTENCY_CONFLICT/);
});

test("FAQ video validation parses a complete MP4 container and rejects magic-only files", async () => {
  const video = await validateFaqMedia(validMp4Fixture(), "INSTRUCTION", "video/mp4");
  assert.equal(video.durationMs, 2_500);
  const magicOnly = Buffer.alloc(16);
  magicOnly.write("ftyp", 4, 4, "ascii");
  await assert.rejects(() => validateFaqMedia(magicOnly, "INSTRUCTION", "video/mp4"), /INVALID_VIDEO_CONTAINER/);
});

test("FAQ video validation parses bounded WebM EBML metadata", async () => {
  const video = await validateFaqMedia(validWebmFixture(), "INSTRUCTION", "video/webm");
  assert.equal(video.durationMs, 2_500);
  await assert.rejects(
    () => validateFaqMedia(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "INSTRUCTION", "video/webm"),
    /INVALID_VIDEO_CONTAINER/,
  );
});

test("FAQ media route guards allocation and never rolls back committed storage", () => {
  const source = readFileSync("app/api/admin/products/[id]/faqs/[faqId]/media/route.ts", "utf8");
  assert.match(source, /content-length/);
  assert.match(source, /file\.size <= 0 \|\| file\.size > maxFileBytes/);
  assert.match(source, /stored && !databaseCommitted/);
  assert.match(source, /isFaqMutationReplay/);
  assert.ok(source.indexOf("await validateFaqMediaMutationTarget") < source.indexOf("await saveImmutableProductAsset"));
});

test("FAQ media upload requires a bounded positive Content-Length before multipart parsing", () => {
  assert.equal(faqUploadLengthError(null), "CONTENT_LENGTH_REQUIRED");
  assert.equal(faqUploadLengthError(""), "CONTENT_LENGTH_REQUIRED");
  assert.equal(faqUploadLengthError("0"), "INVALID_CONTENT_LENGTH");
  assert.equal(faqUploadLengthError("invalid"), "INVALID_CONTENT_LENGTH");
  assert.equal(faqUploadLengthError(String(FAQ_MAX_MULTIPART_BYTES + 1)), "MEDIA_TOO_LARGE");
  assert.equal(faqUploadLengthError(String(FAQ_MAX_MULTIPART_BYTES)), null);
});

test("legacy FAQ apply requires an explicit actor and fingerprints protected commerce data", () => {
  const source = readFileSync("scripts/migrate-product-faqs.ts", "utf8");
  assert.match(source, /--admin-id/);
  assert.match(source, /protectedFingerprints/);
  for (const protectedModel of ["productTranslation", "productVariant", "variantTranslation", "productImage", "order", "orderItem"]) {
    assert.match(source, new RegExp(`prisma\\.${protectedModel}\\.findMany`));
  }
  assert.match(source, /LEGACY_PRODUCT_ATTRIBUTES/);
});
