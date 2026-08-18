import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import {
  buildRestoredImageKey,
  discardArchivedProductImage,
  ProductImageStudioError,
  restoreArchivedProductImage,
  toStudioErrorResponse,
} from "@/lib/product-image-studio";
import { getOrderedProductImages, lockProductImages, productImageTransactionOptions } from "@/lib/product-image-studio-db";
import { revalidateProductImageStorefront } from "@/lib/product-image-revalidation";
import { prisma } from "@/lib/prisma";
import { deleteProductImage, publicImageUrl } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; trashId: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id: productId, trashId } = await params;
  let activeStorageKey: string | undefined;
  let databaseCommitted = false;
  try {
    const trashed = await prisma.productImageTrash.findFirst({
      where: { id: trashId, productId },
      include: { product: { select: { slug: true } } },
    });
    if (!trashed) throw new ProductImageStudioError("NOT_FOUND", "Deze afbeelding staat niet meer in de prullenbak.", 404);

    activeStorageKey = buildRestoredImageKey(trashed.originalStorageKey, trashed.product.slug);
    const restoredImageUrl = publicImageUrl(activeStorageKey);
    await restoreArchivedProductImage(trashed.archiveStorageKey, activeStorageKey);

    const image = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, productId);
      const current = await getOrderedProductImages(tx, productId);
      const restored = await tx.productImage.create({
        data: {
          productId,
          storageKey: activeStorageKey!,
          alt: trashed.alt,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        },
      });
      await tx.productImageTrash.delete({ where: { id: trashed.id } });
      return restored;
    }, productImageTransactionOptions);
    databaseCommitted = true;

    await discardArchivedProductImage({ sourceKey: trashed.originalStorageKey, archiveKey: trashed.archiveStorageKey });
    await revalidateProductImageStorefront(productId);
    return NextResponse.json({ ok: true, image: { ...image, url: restoredImageUrl } });
  } catch (error) {
    // Only remove the copied object while the database still has no active row for it.
    // Once committed, deleting it here would leave a broken image if a later cache step failed.
    if (activeStorageKey && !databaseCommitted) await deleteProductImage(activeStorageKey).catch(() => undefined);
    const mapped = toStudioErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
