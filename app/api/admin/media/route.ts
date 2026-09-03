import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  buildMediaLibraryKey,
  deleteProductImage,
  hasValidImageSignature,
  isAllowedContentType,
  publicImageUrl,
  saveProductImage,
} from "@/lib/storage";

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const PAGE_SIZE = 60;

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const cursor = request.nextUrl.searchParams.get("cursor");
  const assets = await prisma.mediaAsset.findMany({
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { uploadedByAdmin: { select: { name: true } } },
  });
  const hasMore = assets.length > PAGE_SIZE;
  const page = hasMore ? assets.slice(0, PAGE_SIZE) : assets;

  return NextResponse.json({
    assets: page.map((asset) => ({
      id: asset.id,
      url: publicImageUrl(asset.storageKey),
      originalFilename: asset.originalFilename,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
      uploadedByName: asset.uploadedByAdmin?.name ?? null,
      createdAt: asset.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const altText = form?.get("altText");
  if (!(file instanceof File) || !isAllowedContentType(file.type) || file.size <= 0 || file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: "INVALID_IMAGE", message: "Gebruik JPG, PNG, WebP of AVIF van maximaal 8 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(bytes, file.type)) {
    return NextResponse.json({ error: "INVALID_IMAGE_SIGNATURE", message: "De bestandsinhoud komt niet overeen met het gekozen afbeeldingsformaat." }, { status: 400 });
  }

  const storageKey = buildMediaLibraryKey(file.name);
  let stored = false;
  try {
    await saveProductImage(storageKey, bytes, file.type);
    stored = true;
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          storageKey,
          originalFilename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          altText: typeof altText === "string" ? altText.trim() || null : null,
          uploadedByAdminId: admin.id,
        },
      });
      await recordAudit(tx, admin, "MediaAsset", created.id, "CREATE", null, created);
      return created;
    });
    return NextResponse.json(
      { ok: true, asset: { ...asset, url: publicImageUrl(asset.storageKey), createdAt: asset.createdAt.toISOString() } },
      { status: 201 }
    );
  } catch (error) {
    if (stored) {
      await deleteProductImage(storageKey).catch((cleanupError) => {
        console.error("Failed to clean up media asset after database failure", { storageKey, cleanupError });
      });
    }
    console.error("Failed to upload media asset", error);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: "De afbeelding kon niet veilig worden opgeslagen." }, { status: 502 });
  }
}
