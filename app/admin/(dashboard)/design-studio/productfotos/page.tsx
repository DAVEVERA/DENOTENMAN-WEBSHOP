import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import type { DesignAssetDto, DesignStudioProduct } from "@/lib/design-studio/photoroom-schema";
import { PhotoRoomWorkspace } from "@/components/admin-panel/design-studio/PhotoRoomWorkspace";

export default async function ProductPhotoStudioPage({ searchParams }: { searchParams: Promise<{ productId?: string; imageId?: string }> }) {
  await connection();
  const [{ productId, imageId }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { role: true, active: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const [products, assets] = await Promise.all([
    prisma.product.findMany({
      where: { images: { some: {} } },
      select: {
        id: true,
        translations: { where: { locale: "nl" }, select: { name: true }, take: 1 },
        images: { select: { id: true, storageKey: true, alt: true, isPrimary: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
      orderBy: { updatedAt: "desc" },
      take: 250,
    }),
    prisma.designAsset.findMany({ where: { status: { in: ["DRAFT", "PUBLISHED"] } }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);

  const studioProducts: DesignStudioProduct[] = products.map((product) => ({
    id: product.id,
    name: product.translations[0]?.name || "Product zonder Nederlandse naam",
    images: product.images.map((image) => ({ ...image, url: publicImageUrl(image.storageKey) })),
  })).sort((left, right) => left.name.localeCompare(right.name, "nl"));
  const drafts: DesignAssetDto[] = assets.map((asset) => ({
    id: asset.id,
    jobId: asset.jobId,
    productId: asset.productId,
    sourceImageId: asset.sourceImageId,
    url: publicImageUrl(asset.storageKey),
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    status: asset.status,
    productImageId: asset.productImageId,
    createdAt: asset.createdAt.toISOString(),
  }));

  return (
    <PhotoRoomWorkspace
      initialProducts={studioProducts}
      initialAssets={drafts}
      initialProductId={productId}
      initialImageId={imageId}
      configured={Boolean(process.env.PHOTOROOM_API_KEY?.trim())}
      allowed={Boolean(admin?.active && (admin.role === "OWNER" || admin.role === "ADMIN"))}
    />
  );
}
