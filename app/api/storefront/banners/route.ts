import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { bannerMatchesPath } from "@/lib/marketing/banner-placement";

export async function GET(request: Request) {
  const pathname = new URL(request.url).searchParams.get("path") ?? "";
  if (!/^\/(nl|en|fr)(?:\/[^?#]*)?$/u.test(pathname) || pathname.length > 500) {
    return Response.json({ error: "INVALID_PATH" }, { status: 400 });
  }
  const now = new Date();
  const banners = await prisma.marketingBanner.findMany({
    where: {
      isActive: true,
      isPublished: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return Response.json({ banners: banners.filter((banner) => bannerMatchesPath(banner.placement, banner.targetPath, pathname)).map((banner) => ({
    id: banner.id, title: banner.title, slot: banner.slot,
    imageUrl: /^https?:\/\//iu.test(banner.imageUrl) || banner.imageUrl.startsWith("/") ? banner.imageUrl : publicImageUrl(banner.imageUrl),
    linkUrl: banner.linkUrl && (/^https:\/\//iu.test(banner.linkUrl) || /^\/(?!\/)/u.test(banner.linkUrl)) ? banner.linkUrl : null,
  })) }, { headers: { "Cache-Control": "no-store" } });
}
