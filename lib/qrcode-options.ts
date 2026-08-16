import { prisma } from "@/lib/prisma";

export type QrProductOption = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  categoryLabel: string | null;
};

export type QrCategoryOption = {
  id: string;
  label: string;
};

// Options for the QR-code workbench's "product" / "category" target type
// pickers. entityType strings elsewhere use Prisma model names — these are
// unrelated display option lists, not auditable entities.
export async function listQrProductOptions(): Promise<QrProductOption[]> {
  const products = await prisma.product.findMany({
    where: { translations: { some: { locale: "nl" } } },
    include: {
      translations: { where: { locale: "nl" } },
      productCategories: {
        include: { category: { include: { translations: { where: { locale: "nl" } } } } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
    },
    orderBy: { slug: "asc" },
  });

  return products
    .map((product) => {
      const translation = product.translations[0];
      if (!translation) return null;
      const primaryCategory = product.productCategories[0]?.category;
      const categoryLabel = primaryCategory?.translations[0]?.name ?? null;

      const option: QrProductOption = {
        id: product.id,
        name: translation.name,
        slug: translation.slug,
        category: primaryCategory?.slug ?? null,
        categoryLabel,
      };
      return option;
    })
    .filter((option): option is QrProductOption => option !== null);
}

export async function listQrCategoryOptions(): Promise<QrCategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { translations: { where: { locale: "nl" } } },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
  });

  return categories
    .map((category) => {
      const translation = category.translations[0];
      if (!translation) return null;
      const option: QrCategoryOption = { id: translation.slug, label: translation.name };
      return option;
    })
    .filter((option): option is QrCategoryOption => option !== null);
}

export function getSiteUrl(): string {
  return process.env.SITE_URL ?? "https://www.denotenman.nl";
}
