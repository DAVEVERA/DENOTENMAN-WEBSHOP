export const catalogSortValues = [
  "PRICE_ASC",
  "PRICE_DESC",
  "POPULAR",
  "BEST_SELLING",
  "MOST_VIEWED",
] as const;

export type CatalogSort = (typeof catalogSortValues)[number];

export const defaultCatalogSort: CatalogSort = "POPULAR";

const catalogSortSet = new Set<string>(catalogSortValues);

export function normalizeCatalogSort(value: string | null | undefined): CatalogSort {
  const normalized = value?.trim().toUpperCase() ?? "";
  return catalogSortSet.has(normalized) ? (normalized as CatalogSort) : defaultCatalogSort;
}

export type CatalogSortCandidate<T> = {
  product: T;
  id: string;
  name: string;
  priceCents: number;
  soldQuantity: number;
  viewCount: number;
};

// One completed product sale counts as five deliberate product views. Keeping
// this weight explicit makes the blended "popular" order predictable while
// the dedicated sales and view sorts remain pure.
export const popularitySaleWeight = 5;

export function popularityScore(candidate: Pick<CatalogSortCandidate<unknown>, "soldQuantity" | "viewCount">): number {
  return candidate.soldQuantity * popularitySaleWeight + candidate.viewCount;
}

export function sortCatalogCandidates<T>(
  candidates: CatalogSortCandidate<T>[],
  sort: CatalogSort,
  locale: string
): CatalogSortCandidate<T>[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const stableNameOrder = (left: CatalogSortCandidate<T>, right: CatalogSortCandidate<T>) =>
    collator.compare(left.name, right.name) || left.id.localeCompare(right.id);

  return [...candidates].sort((left, right) => {
    if (sort === "PRICE_ASC") {
      return left.priceCents - right.priceCents || stableNameOrder(left, right);
    }
    if (sort === "PRICE_DESC") {
      return right.priceCents - left.priceCents || stableNameOrder(left, right);
    }
    if (sort === "BEST_SELLING") {
      return right.soldQuantity - left.soldQuantity || stableNameOrder(left, right);
    }
    if (sort === "MOST_VIEWED") {
      return right.viewCount - left.viewCount || stableNameOrder(left, right);
    }

    return popularityScore(right) - popularityScore(left) ||
      right.soldQuantity - left.soldQuantity ||
      right.viewCount - left.viewCount ||
      stableNameOrder(left, right);
  });
}
