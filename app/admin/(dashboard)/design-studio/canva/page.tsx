import Link from "next/link";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { canvaConnectionSummary } from "@/lib/canva/connection";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import { publicImageUrl } from "@/lib/storage";
import { CanvaConnectionCard } from "@/components/admin-panel/canva/CanvaConnectionCard";
import { CanvaStudioGallery } from "./CanvaStudioGallery";

export default async function CanvaStudioPage({ searchParams }: { searchParams: Promise<{ canva?: string }> }) {
  await connection();
  const [{ canva: notice }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const [summary, recent] = await Promise.all([
    canvaConnectionSummary().catch(() => ({ configured: false, connected: false, displayName: null, connectedAt: null })),
    prisma.mediaAsset.findMany({ where: { originalFilename: { startsWith: "Canva:" } }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);

  return (
    <div>
      <Link href="/admin/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Design Studio</Link>
      <div className="mt-3 max-w-3xl">
        <p className="font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Design Studio · Canva</p>
        <h1 className="mt-2 text-heading-xl text-text">Canva-designs</h1>
        <p className="mt-3 text-body-md leading-7 text-muted">Ontwerp in Canva en zet het resultaat met één klik in de mediabibliotheek. Daarna kies je het in nieuwsbrieven, productfoto&apos;s en social posts.</p>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <CanvaStudioGallery
          connected={summary.connected}
          initial={recent.map((asset) => ({ id: asset.id, url: publicImageUrl(asset.storageKey), title: asset.originalFilename.replace(/^Canva:\s*/u, ""), createdAt: asset.createdAt.toISOString() }))}
        />
        <CanvaConnectionCard initial={summary} notice={notice ?? null} siteUrl={BASE_URL} returnTo="/admin/design-studio/canva" />
      </div>
    </div>
  );
}
