import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { deleteProductImage } from "@/lib/storage";

const patchSchema = z.object({ altText: z.string().trim().max(300).nullable() }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id } = await context.params;
  const existing = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.update({
      where: { id },
      data: { altText: parsed.data.altText?.trim() || null },
    });
    await recordAudit(tx, admin, "MediaAsset", id, "UPDATE", existing, asset);
    return asset;
  });

  return NextResponse.json({ ok: true, asset: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id } = await context.params;
  const existing = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.delete({ where: { id } });
    await recordAudit(tx, admin, "MediaAsset", id, "DELETE", existing, null);
  });
  await deleteProductImage(existing.storageKey).catch((cleanupError) => {
    console.error("Failed to delete media asset object from storage", { storageKey: existing.storageKey, cleanupError });
  });

  return NextResponse.json({ ok: true });
}
