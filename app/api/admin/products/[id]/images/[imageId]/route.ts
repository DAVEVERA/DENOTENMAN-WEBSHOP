import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { deleteProductImage } from "@/lib/storage";

const imagePatchSchema = z.object({
  alt: z.string().trim().max(240).nullable(),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, imageId } = await params;
  const parsed = imagePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) await tx.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: parsed.data });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, imageId } = await params;
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const remaining = await prisma.productImage.count({ where: { productId: id, id: { not: imageId } } });
  if (remaining === 0) return NextResponse.json({ error: "LAST_IMAGE", message: "Upload eerst een vervangende afbeelding." }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const replacement = await tx.productImage.findFirst({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
      if (replacement) await tx.productImage.update({ where: { id: replacement.id }, data: { isPrimary: true } });
    }
  });
  await deleteProductImage(image.storageKey).catch((error) => console.error(`Failed to delete GCS object ${image.storageKey}`, error));
  return NextResponse.json({ ok: true });
}
