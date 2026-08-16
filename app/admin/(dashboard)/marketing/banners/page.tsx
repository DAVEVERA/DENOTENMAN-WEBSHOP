import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";
import { BannerRowActions } from "./BannerRowActions";

const PLACEMENT_LABELS: Record<string, string> = {
  HOMEPAGE: "Homepage",
  CATEGORY: "Categorie",
  PROMOTION: "Promotie",
};

function resolveImageSrc(imageUrl: string): string {
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/")) {
    return imageUrl;
  }
  try {
    return publicImageUrl(imageUrl);
  } catch {
    return imageUrl;
  }
}

export default async function MarketingBannersPage() {
  const banners = await prisma.marketingBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Banners</h1>
          <p className="mt-1 text-body-sm text-muted">
            {banners.length} {banners.length === 1 ? "banner" : "banners"}
          </p>
        </div>
        <Link
          href="/admin/marketing/banners/nieuw"
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
        >
          Nieuwe banner
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Afbeelding</th>
              <th className="px-4 py-3 font-heading">Titel</th>
              <th className="px-4 py-3 font-heading">Plaatsing</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 text-right font-heading">Sortering</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {banners.map((banner) => (
              <tr key={banner.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3">
                  <img
                    src={resolveImageSrc(banner.imageUrl)}
                    alt={banner.title}
                    className="h-12 w-20 rounded-button border border-border object-cover"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-text">{banner.title}</p>
                  {banner.linkUrl ? (
                    <p className="mt-0.5 truncate text-muted">{banner.linkUrl}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted">
                    {banner.startsAt ? formatDate(banner.startsAt, "nl") : "—"} –{" "}
                    {banner.endsAt ? formatDate(banner.endsAt, "nl") : "—"}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {PLACEMENT_LABELS[banner.placement] ?? banner.placement}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      banner.isActive
                        ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                        : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {banner.isActive ? "Actief" : "Inactief"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text">{banner.sortOrder}</td>
                <td className="px-4 py-3 text-right">
                  <BannerRowActions bannerId={banner.id} isActive={banner.isActive} />
                </td>
              </tr>
            ))}
            {banners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Geen banners gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
