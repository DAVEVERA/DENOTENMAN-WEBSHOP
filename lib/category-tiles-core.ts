// Which tiles a category page shows and which photo each gets. Pure, so it can be tested.

import type { SubmenuItem } from "@/lib/category-submenu";

export type TileProduct = {
  id: string;
  /** Every translated name, lower-cased, used to match a catalogue filter. */
  names: string[];
  categoryIds: string[];
  imageSrc: string | null;
  sold: number;
};

export type CategoryTileData = SubmenuItem & { imageSrc: string | null; productCount: number };

const bestSellerFirst = (left: TileProduct, right: TileProduct) =>
  right.sold - left.sold || (left.imageSrc ? 0 : 1) - (right.imageSrc ? 0 : 1);

function photoOf(products: TileProduct[]): string | null {
  return [...products].filter((product) => product.imageSrc).sort(bestSellerFirst)[0]?.imageSrc ?? null;
}

/**
 * A child category gets its best-selling product's photo and is dropped when it has no
 * products. A catalogue filter is always kept (it is a menu entry) and takes the photo of
 * the best-selling product whose name matches; "all" takes the best seller of the category.
 */
export function buildCategoryTiles(
  items: SubmenuItem[],
  products: TileProduct[],
  subtreeIds: (categoryId: string) => string[],
): CategoryTileData[] {
  return items.flatMap((item): CategoryTileData[] => {
    if (item.categoryId) {
      const ids = new Set(subtreeIds(item.categoryId));
      const matching = products.filter((product) => product.categoryIds.some((id) => ids.has(id)));
      return matching.length ? [{ ...item, imageSrc: photoOf(matching), productCount: matching.length }] : [];
    }
    const queries = (item.queries ?? (item.query ? [item.query] : [])).map((query) => query.trim().toLocaleLowerCase()).filter(Boolean);
    const matching = queries.length ? products.filter((product) => product.names.some((name) => queries.some((query) => name.includes(query)))) : products;
    return [{ ...item, imageSrc: photoOf(matching), productCount: matching.length }];
  });
}
