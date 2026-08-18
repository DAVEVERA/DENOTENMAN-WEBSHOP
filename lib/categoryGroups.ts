import type { CategoryType } from "@prisma/client";

export type NavigationCategorySourceDto = {
  id: string;
  canonicalSlug: string;
  slug: string;
  name: string;
  description: string | null;
  type: CategoryType;
  parentId: string | null;
  sortOrder: number;
};

export type NavigationCategoryDto = Pick<
  NavigationCategorySourceDto,
  "id" | "canonicalSlug" | "slug" | "name" | "description" | "type" | "parentId"
> & {
  children: NavigationCategoryDto[];
};

export type CategoryNavigationDto = {
  categories: NavigationCategoryDto[];
  promotional?: NavigationCategoryDto;
};

export type MainCategoryGroupDto<T extends NavigationCategoryDto = NavigationCategoryDto> = {
  label: string;
  primarySlug: string;
  categories: T[];
};

/** Build one locale-correct navigation tree from the Prisma Category graph. */
export function buildCategoryNavigation(
  sources: NavigationCategorySourceDto[]
): CategoryNavigationDto {
  const ordered = [...sources].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
  const nodes = new Map<string, NavigationCategoryDto>();
  for (const source of ordered) {
    nodes.set(source.id, {
      id: source.id,
      canonicalSlug: source.canonicalSlug,
      slug: source.slug,
      name: source.name,
      description: source.description,
      type: source.type,
      parentId: source.parentId,
      children: [],
    });
  }

  for (const source of ordered) {
    if (!source.parentId) continue;
    const parent = nodes.get(source.parentId);
    const child = nodes.get(source.id);
    if (parent && child && parent !== child) parent.children.push(child);
  }

  const roots = ordered
    .filter((source) => source.parentId === null || !nodes.has(source.parentId))
    .map((source) => nodes.get(source.id))
    .filter((category): category is NavigationCategoryDto => category !== undefined);
  const promotional = roots.find((category) => category.type === "PROMOTIONAL");

  return {
    categories: roots.filter((category) => category.type !== "PROMOTIONAL"),
    promotional,
  };
}

/** @deprecated Storefront navigation should use buildCategoryNavigation. */
export function groupMainCategories<
  T extends Pick<NavigationCategoryDto, "id" | "slug" | "name" | "type">
>(categories: T[]): {
  groups: Array<{ label: string; primarySlug: string; categories: T[] }>;
  promotional?: T;
} {
  const promotional = categories.find((category) => category.type === "PROMOTIONAL");
  return {
    groups: categories
      .filter((category) => category.type !== "PROMOTIONAL")
      .map((category) => ({
        label: category.name,
        primarySlug: category.slug,
        categories: [category],
      })),
    promotional,
  };
}
