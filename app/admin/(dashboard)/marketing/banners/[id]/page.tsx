import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BannerCreateForm } from "../nieuw/BannerCreateForm";

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = await prisma.marketingBanner.findUnique({ where: { id } });
  if (!banner) notFound();
  return <div>
    <Link href="/admin/marketing/banners" className="text-body-sm text-accent-hover underline">← Terug naar banners</Link>
    <h1 className="mt-3 text-heading-xl text-text">Banner bewerken</h1>
    <p className="mt-1 text-body-sm text-muted">Upload een nieuw beeld, pas de plaatsing of periode aan en publiceer zelf.</p>
    <div className="mt-3 flex gap-4 text-body-sm"><Link href="/admin/design-studio" className="text-accent-hover underline">Beeld bewerken</Link><Link href="/admin/marketing/media-bibliotheek" className="text-accent-hover underline">Mediabibliotheek</Link></div>
    <div className="mt-8"><BannerCreateForm initial={{ ...banner, startsAt: banner.startsAt?.toISOString() ?? null, endsAt: banner.endsAt?.toISOString() ?? null }} /></div>
  </div>;
}
