import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import { publicImageUrl } from "@/lib/storage";
import { collectDescendantCategoryIds } from "@/lib/category-hierarchy";
import { categorySubmenu, type SubmenuItem } from "@/lib/category-submenu";
import { buildCategoryTiles, type CategoryTileData, type TileProduct } from "@/lib/category-tiles-core";
import { getCategoryNavigation, resolveTranslation } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";

export type CategoryTiles = {
  /** The main category as in the menu, or null when it does not exist. */
  root: { id: string; slug: string; name: string } | null;
  tiles: CategoryTileData[];
  /** True when the category has no submenu, so the tiles are its products. */
  productTiles: boolean;
};

export const getCategoryTiles = cache(async (locale: Locale, canonicalSlug: string): Promise<CategoryTiles> => {
  const navigation = await getCategoryNavigation(locale);
  const { root, items } = categorySubmenu(navigation.categories, canonicalSlug, locale);
  if (!root) return { root: null, tiles: [], productTiles: false };

  const graph = await prisma.category.findMany({ where: { isActive: true }, select: { id: true, parentId: true } });
  const subtreeIds = (categoryId: string) => collectDescendantCategoryIds(categoryId, graph);
  const rows = await prisma.product.findMany({
    where: { isActive: true, productCategories: { some: { categoryId: { in: subtreeIds(root.id) } } } },
    select: {
      id: true,
      translations: { select: { locale: true, name: true, slug: true } },
      productCategories: { select: { categoryId: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { storageKey: true } },
      variants: { select: { id: true } },
    },
  });
  const sales = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: { variantId: { in: rows.flatMap((row) => row.variants.map((variant) => variant.id)) }, order: { status: { in: ["PAID", "FULFILLED"] }, isTest: false } },
    _sum: { quantity: true },
  });
  const soldByVariant = new Map(sales.map((row) => [row.variantId, row._sum.quantity ?? 0]));
  const products = rows.map((row) => ({
    row,
    tile: {
      id: row.id,
      names: row.translations.map((translation) => translation.name.toLocaleLowerCase()),
      categoryIds: row.productCategories.map((link) => link.categoryId),
      imageSrc: row.images[0] ? publicImageUrl(row.images[0].storageKey) : null,
      sold: row.variants.reduce((sum, variant) => sum + (soldByVariant.get(variant.id) ?? 0), 0),
    } satisfies TileProduct,
  }));

  const rootInfo = { id: root.id, slug: root.slug, name: root.name };
  if (items.length > 0) {
    const tiles = buildCategoryTiles(items, products.map((entry) => entry.tile), subtreeIds);
    const withoutPhoto = tiles.filter((tile) => !tile.imageSrc).map((tile) => tile.name);
    // Categories have no photo of their own, so this is the list that still shows the placeholder.
    if (withoutPhoto.length) console.warn("Category tiles without a photo", { category: canonicalSlug, locale, tiles: withoutPhoto });
    return { root: rootInfo, tiles, productTiles: false };
  }

  // No submenu: show the products themselves, linking to their product pages.
  const productItems = products
    .sort((left, right) => right.tile.sold - left.tile.sold)
    .flatMap((entry): SubmenuItem[] => {
      const translation = resolveTranslation(entry.row.translations, locale);
      return translation ? [{ key: entry.row.id, name: translation.name, href: productPath(locale, translation.slug) }] : [];
    });
  const byKey = new Map(products.map((entry) => [entry.row.id, entry.tile]));
  return {
    root: rootInfo,
    tiles: productItems.map((item) => ({ ...item, imageSrc: byKey.get(item.key)?.imageSrc ?? null, productCount: 1 })),
    productTiles: true,
  };
});
