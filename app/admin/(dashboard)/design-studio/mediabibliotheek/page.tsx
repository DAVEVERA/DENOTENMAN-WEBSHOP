import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

const PAGE_SIZE = 40;

const providerLabels: Record<string, string> = {
  PHOTOROOM: "PhotoRoom",
  VMODEL: "VModel",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Concept",
  PUBLISHED: "Gepubliceerd",
  DISCARDED: "Verwijderd",
};

const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-background text-muted",
  PUBLISHED: "bg-green-100 text-green-800",
  DISCARDED: "bg-red-50 text-red-800",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(value);
}

function queryString(params: Record<string, string>): string {
  const search = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, value]) => value)));
  const value = search.toString();
  return value ? `?${value}` : "";
}

export default async function DesignStudioMediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; provider?: string; status?: string; page?: string }>;
}) {
  await connection();
  const [{ q: rawQ, provider: rawProvider, status: rawStatus, page: rawPage }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId }, select: { active: true } });
  if (!admin?.active) redirect("/admin/login");

  const q = rawQ?.trim() ?? "";
  const provider = rawProvider === "PHOTOROOM" || rawProvider === "VMODEL" ? rawProvider : "ALL";
  const status = rawStatus === "DRAFT" || rawStatus === "PUBLISHED" || rawStatus === "DISCARDED" ? rawStatus : "ALL";
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const where: Prisma.DesignAssetWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(provider !== "ALL" ? { job: { provider } } : {}),
    ...(q ? { product: { translations: { some: { locale: "nl", name: { contains: q, mode: "insensitive" } } } } } : {}),
  };

  const [total, assets] = await Promise.all([
    prisma.designAsset.count({ where }),
    prisma.designAsset.findMany({
      where,
      select: {
        id: true,
        storageKey: true,
        width: true,
        height: true,
        fileSize: true,
        status: true,
        createdAt: true,
        productId: true,
        job: { select: { provider: true } },
        product: { select: { translations: { where: { locale: "nl" }, select: { name: true }, take: 1 } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = { q, provider: provider === "ALL" ? "" : provider, status: status === "ALL" ? "" : status };

  return (
    <div>
      <Link href="/admin/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Design Studio</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Mediabibliotheek</h1>
          <p className="mt-1 text-body-sm text-muted">Alle Studio-resultaten van PhotoRoom en VModel, ongeacht product.</p>
        </div>
        <p className="text-body-sm text-muted">{assets.length} van {total} {total === 1 ? "resultaat" : "resultaten"}</p>
      </div>

      <form action="/admin/design-studio/mediabibliotheek" method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <input type="text" name="q" defaultValue={q} placeholder="Zoek op productnaam…" className="min-h-11 w-full max-w-sm rounded-button border border-border bg-surface px-3 text-body-sm text-text" />
        <select name="provider" defaultValue={provider} className="min-h-11 rounded-button border border-border bg-surface px-3 text-body-sm text-text">
          <option value="ALL">Alle providers</option>
          <option value="PHOTOROOM">PhotoRoom</option>
          <option value="VMODEL">VModel</option>
        </select>
        <select name="status" defaultValue={status} className="min-h-11 rounded-button border border-border bg-surface px-3 text-body-sm text-text">
          <option value="ALL">Alle statussen</option>
          <option value="DRAFT">Concept</option>
          <option value="PUBLISHED">Gepubliceerd</option>
          <option value="DISCARDED">Verwijderd</option>
        </select>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button hover:bg-accent-hover">Filteren</button>
        {q || provider !== "ALL" || status !== "ALL" ? <Link href="/admin/design-studio/mediabibliotheek" className="text-body-sm text-accent-hover underline underline-offset-4">Filters wissen</Link> : null}
      </form>

      <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead className="bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Beeld</th>
              <th className="px-4 py-3 font-heading">Product</th>
              <th className="px-4 py-3 font-heading">Provider</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 font-heading">Formaat</th>
              <th className="px-4 py-3 font-heading">Bestand</th>
              <th className="px-4 py-3 font-heading">Datum</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const url = publicImageUrl(asset.storageKey);
              const productName = asset.product.translations[0]?.name || "Onbekend product";
              return (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3"><a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Studio-resultaat voor ${productName}`} className="h-12 w-12 rounded-button border border-border object-cover" /></a></td>
                  <td className="px-4 py-3"><Link href={`/admin/producten/${asset.productId}`} className="font-semibold text-text underline-offset-4 hover:underline">{productName}</Link></td>
                  <td className="px-4 py-3 text-text">{providerLabels[asset.job.provider] || asset.job.provider}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-button px-2 py-1 text-xs font-bold ${statusBadgeClass[asset.status]}`}>{statusLabels[asset.status] || asset.status}</span></td>
                  <td className="px-4 py-3 text-muted">{asset.width} × {asset.height}</td>
                  <td className="px-4 py-3 text-muted">{formatBytes(asset.fileSize)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(asset.createdAt)}</td>
                </tr>
              );
            })}
            {assets.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Geen resultaten gevonden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-end gap-2" aria-label="Mediabibliotheek-pagina's">
          <span className="text-body-sm text-muted">Pagina {Math.min(page, totalPages)} van {totalPages}</span>
          {page > 1 ? <Link className="inline-flex min-h-11 items-center rounded-button border border-border px-4 font-semibold" href={`/admin/design-studio/mediabibliotheek${queryString({ ...baseParams, page: String(page - 1) })}`}>Vorige</Link> : null}
          {page < totalPages ? <Link className="inline-flex min-h-11 items-center rounded-button border border-border px-4 font-semibold" href={`/admin/design-studio/mediabibliotheek${queryString({ ...baseParams, page: String(page + 1) })}`}>Volgende</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
