import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { MediaLibraryClient, type MediaAssetDto } from "./MediaLibraryClient";

const PAGE_SIZE = 60;

export default async function MediaLibraryPage() {
  const assets = await prisma.mediaAsset.findMany({
    take: PAGE_SIZE + 1,
    orderBy: { createdAt: "desc" },
    include: { uploadedByAdmin: { select: { name: true } } },
  });
  const hasMore = assets.length > PAGE_SIZE;
  const page = hasMore ? assets.slice(0, PAGE_SIZE) : assets;
  const initialAssets: MediaAssetDto[] = page.map((asset) => ({
    id: asset.id,
    url: publicImageUrl(asset.storageKey),
    originalFilename: asset.originalFilename,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    altText: asset.altText,
    uploadedByName: asset.uploadedByAdmin?.name ?? null,
    createdAt: asset.createdAt.toISOString(),
  }));

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>

      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Mediabibliotheek</h1>
        <p className="mt-1 text-body-sm text-muted">
          Upload afbeeldingen eenmalig en gebruik ze binnen elke marketingcategorie, waaronder mail flows.
        </p>
      </div>

      <div className="mt-6">
        <MediaLibraryClient initialAssets={initialAssets} initialCursor={hasMore ? page[page.length - 1].id : null} />
      </div>
    </div>
  );
}
