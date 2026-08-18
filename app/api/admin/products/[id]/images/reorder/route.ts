import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  planCanonicalImageOrder,
  ProductImageStudioError,
  toStudioErrorResponse,
} from "@/lib/product-image-studio";
import {
  applyProductImageOrder,
  getOrderedProductImages,
  lockProductImages,
  productImageTransactionOptions,
} from "@/lib/product-image-studio-db";
import { revalidateProductImageStorefront } from "@/lib/product-image-revalidation";
import { publicImageUrl } from "@/lib/storage";

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const reorderSchema = z.object({
  expectedImageIds: z.array(id).min(1).max(100),
  orderedImageIds: z.array(id).min(1).max(100),
  primaryImageId: id,
}).strict();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id: productId } = await params;
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Stuur de volledige huidige en nieuwe afbeeldingsvolgorde mee." },
      { status: 400 }
    );
  }

  try {
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) throw new ProductImageStudioError("NOT_FOUND", "Product niet gevonden.", 404);
    const images = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, productId);
      const current = await getOrderedProductImages(tx, productId);
      const updates = planCanonicalImageOrder({ current, ...parsed.data });
      await applyProductImageOrder(tx, updates);
      return getOrderedProductImages(tx, productId);
    }, productImageTransactionOptions);
    await revalidateProductImageStorefront(productId);
    return NextResponse.json({
      ok: true,
      images: images.map((image) => ({ ...image, url: publicImageUrl(image.storageKey) })),
      expectedImageIds: images.map((image) => image.id),
    });
  } catch (error) {
    const mapped = toStudioErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
