import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  archiveProductImage,
  discardArchivedProductImage,
  finalizeArchivedProductImage,
  planCanonicalImageOrder,
  planImageDeletion,
  ProductImageStudioError,
  StudioValidationError,
  toStudioErrorResponse,
  type ArchivedProductImage,
} from "@/lib/product-image-studio";
import {
  applyProductImageOrder,
  getOrderedProductImages,
  lockProductImages,
  productImageTransactionOptions,
} from "@/lib/product-image-studio-db";
import { revalidateProductImageStorefront } from "@/lib/product-image-revalidation";
import { publicImageUrl } from "@/lib/storage";

const imagePatchSchema = z.object({
  alt: z.string().trim().max(240).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function errorResponse(error: unknown) {
  const mapped = toStudioErrorResponse(error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, imageId } = await params;
  const parsed = imagePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  try {
    const images = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, id);
      const current = await getOrderedProductImages(tx, id);
      const target = current.find((image) => image.id === imageId);
      if (!target) throw new ProductImageStudioError("NOT_FOUND", "De productafbeelding bestaat niet.", 404);

      if (parsed.data.alt !== undefined) {
        await tx.productImage.update({ where: { id: imageId }, data: { alt: parsed.data.alt } });
      }

      const orderedIds = current.map((image) => image.id);
      if (parsed.data.sortOrder !== undefined) {
        if (parsed.data.sortOrder >= current.length) {
          throw new StudioValidationError("VALIDATION_ERROR", "De afbeeldingspositie valt buiten de actieve afbeeldingsset.");
        }
        const previousIndex = orderedIds.indexOf(imageId);
        orderedIds.splice(previousIndex, 1);
        orderedIds.splice(parsed.data.sortOrder, 0, imageId);
      }
      const currentPrimary = current.find((image) => image.isPrimary)?.id ?? orderedIds[0];
      const primaryImageId = parsed.data.isPrimary === true ? imageId : currentPrimary;
      const updates = planCanonicalImageOrder({
        current,
        expectedImageIds: current.map((image) => image.id),
        orderedImageIds: orderedIds,
        primaryImageId,
      });
      await applyProductImageOrder(tx, updates);
      return getOrderedProductImages(tx, id);
    }, productImageTransactionOptions);
    await revalidateProductImageStorefront(id);
    return NextResponse.json({
      ok: true,
      images: images.map((image) => ({ ...image, url: publicImageUrl(image.storageKey) })),
      expectedImageIds: images.map((image) => image.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, imageId } = await params;
  let archived: ArchivedProductImage | undefined;
  try {
    const images = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, id);
      const current = await getOrderedProductImages(tx, id);
      const target = current.find((image) => image.id === imageId);
      const updates = planImageDeletion(current, imageId);
      if (!target) throw new ProductImageStudioError("NOT_FOUND", "De productafbeelding bestaat niet.", 404);

      archived = await archiveProductImage(target.storageKey);
      await tx.productImageTrash.create({
        data: {
          productId: id,
          originalImageId: target.id,
          originalStorageKey: target.storageKey,
          archiveStorageKey: archived.archiveKey,
          alt: target.alt,
          sortOrder: target.sortOrder,
          wasPrimary: target.isPrimary,
        },
      });
      await tx.productImage.delete({ where: { id: imageId } });
      await applyProductImageOrder(tx, updates);
      return getOrderedProductImages(tx, id);
    }, productImageTransactionOptions);
    const cleanupComplete = archived ? await finalizeArchivedProductImage(archived) : true;
    archived = undefined;
    await revalidateProductImageStorefront(id);
    return NextResponse.json({
      ok: true,
      images: images.map((image) => ({ ...image, url: publicImageUrl(image.storageKey) })),
      expectedImageIds: images.map((image) => image.id),
      archived: true,
      cleanupPending: !cleanupComplete,
    });
  } catch (error) {
    if (archived) {
      await discardArchivedProductImage(archived);
    }
    return errorResponse(error);
  }
}
