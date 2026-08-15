import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  buildProductImageKey,
  hasValidImageSignature,
  isAllowedContentType,
  publicImageUrl,
  saveProductImage,
} from "@/lib/storage";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, _count: { select: { images: true } } } });
  if (!product) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const alt = form?.get("alt");
  if (!(file instanceof File) || !isAllowedContentType(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "INVALID_IMAGE", message: "Gebruik JPG, PNG, WebP of AVIF van maximaal 8 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(bytes, file.type)) {
    return NextResponse.json({ error: "INVALID_IMAGE_SIGNATURE" }, { status: 400 });
  }

  const storageKey = buildProductImageKey(product.slug, file.name);
  try {
    await saveProductImage(storageKey, bytes, file.type);
    const image = await prisma.$transaction(async (tx) => {
      const isPrimary = product._count.images === 0;
      const sortOrder = await tx.productImage.count({ where: { productId: id } });
      return tx.productImage.create({
        data: { productId: id, storageKey, alt: typeof alt === "string" ? alt.trim() || null : null, sortOrder, isPrimary },
      });
    });
    return NextResponse.json({ ok: true, image: { ...image, url: publicImageUrl(image.storageKey) } }, { status: 201 });
  } catch (error) {
    console.error(`Failed to upload image for product ${id}`, error);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
