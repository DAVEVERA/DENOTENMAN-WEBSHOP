import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "NOT_FOUND", message: "Product niet gevonden." }, { status: 404 });

  const trash = await prisma.productImageTrash.findMany({
    where: { productId: id },
    orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({
    trash: trash.map((image) => ({
      id: image.id,
      url: publicImageUrl(image.archiveStorageKey),
      alt: image.alt,
      deletedAt: image.deletedAt.toISOString(),
      originalPosition: image.sortOrder,
      wasPrimary: image.wasPrimary,
    })),
  });
}
