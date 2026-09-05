import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import {
  BUSINESS_LOGO_MAX_FILE_BYTES,
  BusinessLogoValidationError,
  buildBusinessLogoStorageKey,
  businessLogoUploadLengthError,
  normalizeBusinessLogo,
} from "@/lib/business-logo";
import {
  BUSINESS_SESSION_COOKIE,
  getBusinessPortalSession,
  recordBusinessEvent,
} from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";
import {
  deleteProductAsset,
  publicStorageUrl,
  saveImmutableProductAsset,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSession(request: NextRequest) {
  return getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
}

function publicLogoUrl(storageKey: string | null): string | null {
  if (!storageKey) return null;
  return publicStorageUrl(storageKey);
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const account = await prisma.businessAccount.findUnique({
    where: { id: session.businessAccountId },
    select: { logoStorageKey: true },
  });
  if (!account) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });

  try {
    return NextResponse.json({ logoUrl: publicLogoUrl(account.logoStorageKey) });
  } catch (error) {
    console.error("Could not resolve business logo URL", { businessAccountId: session.businessAccountId, error });
    return NextResponse.json({ logoUrl: null, unavailable: true });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const lengthError = businessLogoUploadLengthError(request.headers.get("content-length"));
  if (lengthError) return NextResponse.json({ error: lengthError }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "LOGO_REQUIRED" }, { status: 400 });
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > BUSINESS_LOGO_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "LOGO_TOO_LARGE" }, { status: 400 });
  }

  let normalized: Awaited<ReturnType<typeof normalizeBusinessLogo>>;
  try {
    normalized = await normalizeBusinessLogo(Buffer.from(await file.arrayBuffer()), file.type);
  } catch (error) {
    const code = error instanceof BusinessLogoValidationError ? error.code : "INVALID_LOGO_IMAGE";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const account = await prisma.businessAccount.findUnique({
    where: { id: session.businessAccountId },
    select: { id: true, contactName: true, logoStorageKey: true },
  });
  if (!account) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });

  const storageKey = buildBusinessLogoStorageKey(account.id);
  let logoUrl: string;
  try {
    // Resolve configuration before mutating storage or the database. This
    // prevents a successful upload from being reported as failed merely
    // because its public response URL could not be constructed afterwards.
    logoUrl = publicStorageUrl(storageKey);
  } catch (error) {
    console.error("Business logo CDN is not configured", { businessAccountId: account.id, error });
    return NextResponse.json({ error: "LOGO_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  let stored = false;
  let databaseCommitted = false;
  try {
    await saveImmutableProductAsset(storageKey, normalized.bytes, normalized.contentType);
    stored = true;

    const changed = await prisma.$transaction(async (tx) => {
      const update = await tx.businessAccount.updateMany({
        where: { id: account.id, logoStorageKey: account.logoStorageKey },
        data: { logoStorageKey: storageKey },
      });
      if (update.count !== 1) return false;
      await recordBusinessEvent(tx, {
        businessAccountId: account.id,
        type: "ACCOUNT_UPDATED",
        actorType: "CUSTOMER",
        actorName: account.contactName,
        summary: `${account.contactName} heeft het bedrijfslogo bijgewerkt`,
        metadata: { fields: ["logo"] },
      });
      return true;
    });
    if (!changed) {
      await deleteProductAsset(storageKey).catch(() => undefined);
      return NextResponse.json({ error: "LOGO_CHANGED_CONCURRENTLY" }, { status: 409 });
    }
    databaseCommitted = true;

    let cleanupPending = false;
    if (account.logoStorageKey) {
      await deleteProductAsset(account.logoStorageKey).catch((error) => {
        cleanupPending = true;
        console.error("Could not remove replaced business logo", { businessAccountId: account.id, error });
      });
    }
    return NextResponse.json({
      ok: true,
      logoUrl,
      width: normalized.width,
      height: normalized.height,
      cleanupPending,
    }, { status: 201 });
  } catch (error) {
    if (stored && !databaseCommitted) {
      await deleteProductAsset(storageKey).catch((cleanupError) => {
        console.error("Could not clean up uncommitted business logo", { businessAccountId: account.id, cleanupError });
      });
    }
    console.error("Business logo upload failed", { businessAccountId: account.id, error });
    return NextResponse.json({ error: "LOGO_UPLOAD_FAILED" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const account = await prisma.businessAccount.findUnique({
    where: { id: session.businessAccountId },
    select: { id: true, contactName: true, logoStorageKey: true },
  });
  if (!account) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  if (!account.logoStorageKey) return NextResponse.json({ ok: true, logoUrl: null });

  const changed = await prisma.$transaction(async (tx) => {
    const update = await tx.businessAccount.updateMany({
      where: { id: account.id, logoStorageKey: account.logoStorageKey },
      data: { logoStorageKey: null },
    });
    if (update.count !== 1) return false;
    await recordBusinessEvent(tx, {
      businessAccountId: account.id,
      type: "ACCOUNT_UPDATED",
      actorType: "CUSTOMER",
      actorName: account.contactName,
      summary: `${account.contactName} heeft het bedrijfslogo verwijderd`,
      metadata: { fields: ["logo"] },
    });
    return true;
  });
  if (!changed) return NextResponse.json({ error: "LOGO_CHANGED_CONCURRENTLY" }, { status: 409 });

  let cleanupPending = false;
  await deleteProductAsset(account.logoStorageKey).catch((error) => {
    cleanupPending = true;
    console.error("Could not remove deleted business logo", { businessAccountId: account.id, error });
  });
  return NextResponse.json({ ok: true, logoUrl: null, cleanupPending });
}
