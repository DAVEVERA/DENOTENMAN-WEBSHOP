import Link from "next/link";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, Camera, Sparkles, WandSparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import type { DesignAssetDto, DesignStudioProduct } from "@/lib/design-studio/types";
import { vModelJobDto } from "@/lib/design-studio/vmodel-service";
import { PhotoRoomWorkspace } from "@/components/admin-panel/design-studio/PhotoRoomWorkspace";
import { VModelWorkspace } from "@/components/admin-panel/design-studio/VModelWorkspace";
import { GeminiImageWorkspace } from "@/components/admin-panel/design-studio/GeminiImageWorkspace";

type ProductPhotoSearchParams = { productId?: string; imageId?: string; provider?: string };

function providerHref(provider: "gemini" | "photoroom" | "vmodel", productId?: string, imageId?: string) {
  return {
    pathname: "/admin/design-studio/productfotos",
    query: {
      provider,
      ...(productId ? { productId } : {}),
      ...(imageId ? { imageId } : {}),
    },
  };
}

export default async function ProductPhotoStudioPage({ searchParams }: { searchParams: Promise<ProductPhotoSearchParams> }) {
  await connection();
  const [{ productId, imageId, provider }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { role: true, active: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const selectedProvider = provider === "photoroom" ? "photoroom" : provider === "vmodel" ? "vmodel" : "gemini";
  const databaseProvider = selectedProvider === "vmodel" ? "VMODEL" : selectedProvider === "photoroom" ? "PHOTOROOM" : "GEMINI";

  const [products, assets, pendingJobs] = await Promise.all([
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
    prisma.designAsset.findMany({
      where: { status: { in: ["DRAFT", "PUBLISHED"] }, job: { provider: databaseProvider } },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    selectedProvider === "vmodel"
      ? prisma.designJob.findMany({
          where: { provider: "VMODEL", status: { in: ["QUEUED", "PROCESSING"] } },
          include: { assets: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
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

  const allowed = admin.role === "OWNER" || admin.role === "ADMIN";

  return (
    <div>
      <Link href="/admin/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Design Studio
      </Link>

      <nav aria-label="Kies beeldprovider" className="mt-4 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="max-w-3xl">
          <p className="font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Beeldmotor</p>
          <h2 className="mt-1 text-heading-md text-text">Kies Gemini, PhotoRoom of VModel</h2>
          <p className="mt-2 text-body-sm leading-6 text-muted">Gemini is de standaard voor realistische productscènes en campagnes. PhotoRoom blijft beschikbaar voor vaste uitsneden; VModel blijft als extra provider zichtbaar.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link
            href={providerHref("gemini", productId, imageId)}
            aria-current={selectedProvider === "gemini" ? "page" : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${selectedProvider === "gemini" ? "border-accent-ink bg-accent/10" : "border-border bg-background hover:border-border-hover"}`}
          >
            <Sparkles className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span><span className="block font-heading text-body-sm font-bold text-text">Gemini</span><span className="mt-0.5 block text-xs text-muted">Standaard · realistische scènes en banners</span></span>
          </Link>
          <Link
            href={providerHref("photoroom", productId, imageId)}
            aria-current={selectedProvider === "photoroom" ? "page" : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${selectedProvider === "photoroom" ? "border-accent-ink bg-accent/10" : "border-border bg-background hover:border-border-hover"}`}
          >
            <Camera className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span><span className="block font-heading text-body-sm font-bold text-text">PhotoRoom</span><span className="mt-0.5 block text-xs text-muted">Uitsnijden, achtergrond en schaduw</span></span>
          </Link>
          <Link
            href={providerHref("vmodel", productId, imageId)}
            aria-current={selectedProvider === "vmodel" ? "page" : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${selectedProvider === "vmodel" ? "border-accent-ink bg-accent/10" : "border-border bg-background hover:border-border-hover"}`}
          >
            <WandSparkles className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span><span className="block font-heading text-body-sm font-bold text-text">VModel</span><span className="mt-0.5 block text-xs text-muted">Realistische productscènes, campagnes en banners</span></span>
          </Link>
        </div>
      </nav>

      <div className="mt-6">
        {selectedProvider === "gemini" ? (
          <GeminiImageWorkspace
            initialProducts={studioProducts}
            initialAssets={drafts}
            initialProductId={productId}
            initialImageId={imageId}
            configured={Boolean(process.env.GEMINI_API_KEY?.trim()) && process.env.GEMINI_API_KEY?.trim() !== "MY_GEMINI_API_KEY"}
            allowed={allowed}
            showNavigation={false}
          />
        ) : selectedProvider === "vmodel" ? (
          <VModelWorkspace
            initialProducts={studioProducts}
            initialAssets={drafts}
            initialPendingJobs={pendingJobs.map(vModelJobDto)}
            initialProductId={productId}
            initialImageId={imageId}
            configured={Boolean(process.env.VMODEL_API_KEY?.trim())}
            allowed={allowed}
            mode="product-photos"
            showNavigation={false}
          />
        ) : (
          <PhotoRoomWorkspace
            initialProducts={studioProducts}
            initialAssets={drafts}
            initialProductId={productId}
            initialImageId={imageId}
            configured={Boolean(process.env.PHOTOROOM_API_KEY?.trim())}
            allowed={allowed}
            showNavigation={false}
          />
        )}
      </div>
    </div>
  );
}
