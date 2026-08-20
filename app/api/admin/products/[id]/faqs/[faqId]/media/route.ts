import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authorizeFaqRequest, faqErrorResponse, parseJson } from "@/lib/product-faq-api";
import {
  attachFaqMedia,
  buildFaqMutationRequestHash,
  detachFaqMedia,
  isFaqMutationReplay,
  validateFaqMediaMutationTarget,
} from "@/lib/product-faq-db";
import { faqActionInputSchema, FAQ_MEDIA_TYPES } from "@/lib/product-faq-schema";
import {
  faqMediaMaxBytes,
  faqUploadLengthError,
  FaqMediaValidationError,
  validateFaqMedia,
} from "@/lib/product-faq-media";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { revalidateProductFaq } from "@/lib/product-faq-revalidation";
import { buildProductAssetKey, deleteProductAsset, saveImmutableProductAsset } from "@/lib/storage";

type Context = { params: Promise<{ id: string; faqId: string }> };
const metaSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative(),
  itemVersion: z.coerce.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(120),
  type: z.enum(FAQ_MEDIA_TYPES),
});

export async function POST(request: NextRequest, { params }: Context) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const lengthError = faqUploadLengthError(request.headers.get("content-length"));
  if (lengthError) return NextResponse.json(
    { error: lengthError },
    { status: lengthError === "CONTENT_LENGTH_REQUIRED" ? 411 : lengthError === "MEDIA_TOO_LARGE" ? 413 : 400 },
  );
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400 });
  const parsed = metaSchema.safeParse({ expectedRevision: form.get("expectedRevision"), itemVersion: form.get("itemVersion"), idempotencyKey: form.get("idempotencyKey"), type: form.get("type") });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const { id, faqId } = await params;
  const maxFileBytes = faqMediaMaxBytes(parsed.data.type, file.type);
  if (!maxFileBytes) return NextResponse.json({ error: "MEDIA_TYPE_NOT_ALLOWED" }, { status: 400 });
  if (file.size <= 0 || file.size > maxFileBytes) return NextResponse.json({ error: "MEDIA_TOO_LARGE" }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  let validated;
  try { validated = await validateFaqMedia(bytes, parsed.data.type, file.type); }
  catch (error) { return NextResponse.json({ error: error instanceof FaqMediaValidationError ? error.message : "INVALID_MEDIA" }, { status: 400 }); }
  const originalFilename = file.name.replace(/^.*[\\/]/, "").slice(0, 240) || `upload.${validated.extension}`;
  const contentSha256 = createHash("sha256").update(bytes).digest("hex");
  const requestHash = buildFaqMutationRequestHash("ATTACH_MEDIA", faqId, {
    expectedRevision: parsed.data.expectedRevision,
    itemVersion: parsed.data.itemVersion,
    type: parsed.data.type,
    originalFilename,
    contentSha256,
    ...validated,
  });
  try {
    if (await isFaqMutationReplay(id, faqId, parsed.data.idempotencyKey, "ATTACH_MEDIA", requestHash)) {
      return NextResponse.json(await getAdminProductFaqSet(id));
    }
    await validateFaqMediaMutationTarget(id, faqId, parsed.data.expectedRevision, parsed.data.itemVersion);
  } catch (error) {
    return faqErrorResponse(error);
  }
  const storageKey = buildProductAssetKey(id, `faq/${faqId}`, `upload.${validated.extension}`);
  let stored = false;
  let databaseCommitted = false;
  try {
    await saveImmutableProductAsset(storageKey, bytes, validated.contentType); stored = true;
    const result = await attachFaqMedia(id, faqId, admin, {
      ...parsed.data,
      ...validated,
      storageKey,
      originalFilename,
      requestHash,
    });
    if (result.replayed) {
      await deleteProductAsset(storageKey);
      stored = false;
    } else {
      databaseCommitted = true;
    }
    revalidateProductFaq(id);
    return NextResponse.json(await getAdminProductFaqSet(id), { status: 201 });
  } catch (error) {
    if (stored && !databaseCommitted) await deleteProductAsset(storageKey).catch((cleanupError) => console.error("FAQ media rollback failed", { productId: id, faqId, cleanupError }));
    return faqErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request); if (body instanceof NextResponse) return body;
  const parsed = faqActionInputSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id, faqId } = await params;
  try { await detachFaqMedia(id, faqId, admin, parsed.data); revalidateProductFaq(id); return NextResponse.json(await getAdminProductFaqSet(id)); } catch (error) { return faqErrorResponse(error); }
}
