import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { formatPrice } from "@/lib/format";

type ProductRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  categoryName: string | null;
  basePriceCents: number;
  activeVariantCount: number;
  totalVariantCount: number;
  isActive: boolean;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: q
      ? {
          translations: {
            some: { locale: "nl", name: { contains: q, mode: "insensitive" } },
          },
        }
      : undefined,
    include: {
      translations: { where: { locale: "nl" } },
      images: true,
      variants: { select: { isActive: true } },
      productCategories: {
        include: { category: { include: { translations: { where: { locale: "nl" } } } } },
        orderBy: [{ category: { type: "asc" } }, { category: { sortOrder: "asc" } }],
      },
    },
  });

  const rows: ProductRow[] = products
    .map((product) => {
      const translation = product.translations[0];
      if (!translation) return null;

      const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
      const primaryImage = sortedImages.find((image) => image.isPrimary) ?? sortedImages[0];

      const activeCategoryLink =
        product.productCategories.find((link) => link.category.isActive) ??
        product.productCategories[0];
      const categoryName = activeCategoryLink?.category.translations[0]?.name ?? null;

      const row: ProductRow = {
        id: product.id,
        name: translation.name,
        imageUrl: primaryImage ? publicImageUrl(primaryImage.storageKey) : null,
        imageAlt: primaryImage?.alt ?? translation.name,
        categoryName,
        basePriceCents: product.basePriceCents,
        activeVariantCount: product.variants.filter((variant) => variant.isActive).length,
        totalVariantCount: product.variants.length,
        isActive: product.isActive,
      };

      return row;
    })
    .filter((row): row is ProductRow => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading-xl text-text">Producten</h1>
        <p className="text-body-sm text-muted">
          {rows.length} {rows.length === 1 ? "product" : "producten"}
          {q ? ` gevonden voor “${q}”` : ""}
        </p>
      </div>

      <form action="/admin/producten" method="get" className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Zoek op productnaam…"
          className="w-full max-w-sm rounded-button border border-border px-3 py-2 text-body-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover"
        >
          Zoeken
        </button>
        {q ? (
          <Link
            href="/admin/producten"
            className="text-body-sm text-accent-hover underline underline-offset-4"
          >
            Filter wissen
          </Link>
        ) : null}
      </form>

      <div className="mt-6 max-h-[75vh] overflow-y-auto rounded-panel border border-border bg-surface">
        <table className="w-full text-body-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-heading">Afbeelding</th>
              <th className="px-4 py-3 font-heading">Naam</th>
              <th className="px-4 py-3 font-heading">Categorie</th>
              <th className="px-4 py-3 text-right font-heading">Basisprijs</th>
              <th className="px-4 py-3 text-right font-heading">Actieve varianten</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt={row.imageAlt ?? row.name}
                      className="h-12 w-12 rounded-button border border-border object-cover"
                    />
                  ) : (
                    <span
                      className="block h-12 w-12 rounded-button border border-border bg-background"
                      aria-hidden="true"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/producten/${row.id}`}
                    className="font-semibold text-text underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{row.categoryName ?? "—"}</td>
                <td className="px-4 py-3 text-right text-text">
                  {formatPrice(row.basePriceCents, "nl")}
                </td>
                <td className="px-4 py-3 text-right text-text">
                  {row.activeVariantCount}
                  <span className="text-muted"> / {row.totalVariantCount}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      row.isActive
                        ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                        : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                    }
                  >
                    {row.isActive ? "Actief" : "Inactief"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/producten/${row.id}`}
                    className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
                  >
                    Bewerken
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Geen producten gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
