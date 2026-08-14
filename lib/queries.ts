import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { defaultLocale, type Locale } from "@/lib/i18n";
import { publicImageUrl } from "@/lib/storage";
import type {
  Category,
  CategoryTranslation,
  Product,
  ProductAttribute,
  ProductCategory,
  ProductImage,
  ProductTranslation,
  ProductVariant,
  VariantTranslation,
} from "@prisma/client";

export type ProductImageDto = {
  url: string;
  alt: string | null;
  isPrimary: boolean;
};

export type ProductAttributeDto = {
  key: string;
  value: string;
};

export type ProductCategoryDto = {
  slug: string;
  name: string;
};

export type ProductVariantDto = {
  id: string;
  sku: string;
  priceCents: number;
  stock: number;
  weightGrams: number;
  preparation: string;
  salting: string;
  coating: string;
  label: string | null;
};

export type ProductSummaryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  basePriceCents: number;
  currency: string;
  unit: "WEIGHT" | "VOLUME";
  isActive: boolean;
  images: ProductImageDto[];
  variants: ProductVariantDto[];
  category: ProductCategoryDto | null;
  updatedAt: Date;
};

export type ProductDetailDto = ProductSummaryDto & {
  slugsByLocale: Partial<Record<Locale, string>>;
  attributes: ProductAttributeDto[];
};

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  updatedAt: Date;
};

export type MainCategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type CategoryWithProductsDto = CategoryDto & {
  products: ProductSummaryDto[];
  slugsByLocale: Partial<Record<Locale, string>>;
};

export type PageDto = {
  key: string;
  title: string;
  slug: string;
  body: string;
  updatedAt: Date;
};

export type ArticleSummaryDto = {
  id: string;
  slug: string;
  title: string;
  updatedAt: Date;
};

export type ArticleDetailDto = ArticleSummaryDto & {
  body: string;
};

export type OrderItemDto = {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderDto = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  items: OrderItemDto[];
};

export type ProductAttributeFilter = {
  key: string;
  value: string;
};

export type Paging = {
  limit?: number;
  offset?: number;
};

export type SlugEntryDto = {
  id: string;
  slug: string;
  updatedAt: Date;
};

const defaultPageLimit = 20;
const maxShortDescriptionLength = 160;
// Raised from 100: the homepage's "browse everything" grid (see
// app/[locale]/page.tsx) explicitly requests every active product in one
// call so client-side search/filtering has the full catalog to work with.
// The catalog is already ~120 active products (191 total) — above the old
// cap — so this ceiling now leaves headroom for growth while still guarding
// against a truly unbounded query.
const maxPageLimit = 500;
const defaultPageOffset = 0;

function toShortDescription(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) return null;
  const characters = Array.from(normalized);
  if (characters.length <= maxShortDescriptionLength) return normalized;

  const clipped = characters.slice(0, maxShortDescriptionLength - 1).join("");
  const lastSpace = clipped.lastIndexOf(" ");

  if (lastSpace <= 0) return null;

  return `${clipped.slice(0, lastSpace).trimEnd()}…`;
}

function resolvePaging(paging?: Paging): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(paging?.limit ?? defaultPageLimit, 1),
    maxPageLimit
  );
  const offset = Math.max(paging?.offset ?? defaultPageOffset, 0);

  return { limit, offset };
}

export function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale
): T | undefined {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === defaultLocale)
  );
}

function toSlugsByLocale<T extends { locale: Locale; slug: string }>(
  translations: T[]
): Partial<Record<Locale, string>> {
  return Object.fromEntries(
    translations.map((translation) => [translation.locale, translation.slug])
  );
}

function toProductImageDto(image: ProductImage): ProductImageDto {
  return {
    url: publicImageUrl(image.storageKey),
    alt: image.alt,
    isPrimary: image.isPrimary,
  };
}

function toProductSummaryDto(
  product: Product & {
    translations: ProductTranslation[];
    images: ProductImage[];
    variants: (ProductVariant & { translations: VariantTranslation[] })[];
    productCategories: (ProductCategory & {
      category: Category & { translations: CategoryTranslation[] };
    })[];
  },
  locale: Locale
): ProductSummaryDto | undefined {
  const translation = resolveTranslation(product.translations, locale);

  if (!translation) {
    return undefined;
  }

  return {
    id: product.id,
    slug: translation.slug,
    name: translation.name,
    description: translation.description,
    shortDescription:
      toShortDescription(translation.shortDescription) ??
      toShortDescription(translation.description),
    basePriceCents: product.basePriceCents,
    currency: product.currency,
    unit: product.unit,
    isActive: product.isActive,
    images: product.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toProductImageDto),
    variants: product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => toProductVariantDto(variant, locale)),
    category: toProductCategoryDto(product.productCategories, locale),
    updatedAt: product.updatedAt,
  };
}

// Picks the product's primary category for display/filtering: the first
// active category once sorted STANDARD-before-PROMOTIONAL, then by the
// category's own sortOrder (see productCategories `orderBy` at call sites).
function toProductCategoryDto(
  productCategories: (ProductCategory & {
    category: Category & { translations: CategoryTranslation[] };
  })[],
  locale: Locale
): ProductCategoryDto | null {
  const active = productCategories.filter((link) => link.category.isActive);
  const primary = active[0] ?? productCategories[0];

  if (!primary) {
    return null;
  }

  const translation = resolveTranslation(primary.category.translations, locale);

  if (!translation) {
    return null;
  }

  return { slug: translation.slug, name: translation.name };
}

function toProductVariantDto(
  variant: ProductVariant & { translations: VariantTranslation[] },
  locale: Locale
): ProductVariantDto {
  const translation = resolveTranslation(variant.translations, locale);

  return {
    id: variant.id,
    sku: variant.sku,
    priceCents: variant.priceCents,
    // TEMPORARY: see UNLIMITED_STOCK note in lib/orders.ts.
    stock: process.env.UNLIMITED_STOCK === "true" ? 999 : variant.stock,
    weightGrams: variant.weightGrams,
    preparation: variant.preparation,
    salting: variant.salting,
    coating: variant.coating,
    label: translation?.label ?? null,
  };
}

function toProductAttributesDto(
  attributes: ProductAttribute[],
  locale: Locale
): ProductAttributeDto[] {
  const nonLocalizedKeys = new Set([
    "ingredients",
    "allergens",
    "mayContainTraces",
  ]);
  const localizedPattern = /\.(?:nl|en|fr)$/;

  return attributes
    .map((attr) => {
      const key = attr.key;
      const isNonLocalized = nonLocalizedKeys.has(key) || key.startsWith("nutrition.");

      if (isNonLocalized) {
        return { key, value: attr.value };
      }

      if (localizedPattern.test(key)) {
        const localeSuffix = `.${locale}`;
        if (key.endsWith(localeSuffix)) {
          return {
            key: key.replace(localizedPattern, ""),
            value: attr.value,
          };
        }
        return undefined;
      }

      return { key, value: attr.value };
    })
    .filter((attr): attr is ProductAttributeDto => attr !== undefined);
}

function toCategoryDto(
  category: Category & { translations: CategoryTranslation[] },
  locale: Locale
): CategoryDto | undefined {
  const translation = resolveTranslation(category.translations, locale);

  if (!translation) {
    return undefined;
  }

  return {
    id: category.id,
    slug: translation.slug,
    name: translation.name,
    description: translation.description,
    updatedAt: category.updatedAt,
  };
}

export async function getProductBySlug(
  slug: string,
  locale: Locale
): Promise<ProductDetailDto | null> {
  const translation = await prisma.productTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      product: {
        include: {
          translations: true,
          images: true,
          variants: { include: { translations: true } },
          attributes: true,
          productCategories: {
            include: { category: { include: { translations: true } } },
            orderBy: [{ category: { type: "asc" } }, { category: { sortOrder: "asc" } }],
          },
        },
      },
    },
  });

  const product = translation?.product;

  if (!product) {
    return null;
  }

  const summary = toProductSummaryDto(product, locale);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    slugsByLocale: toSlugsByLocale(product.translations),
    attributes: toProductAttributesDto(product.attributes, locale),
  };
}

export async function getCategory(
  slug: string,
  locale: Locale
): Promise<CategoryWithProductsDto | null> {
  const translation = await prisma.categoryTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      category: {
        include: {
          translations: true,
          productCategories: {
            include: {
              product: {
                include: {
                  translations: true,
                  images: true,
                  variants: { include: { translations: true } },
                  productCategories: {
                    include: { category: { include: { translations: true } } },
                    orderBy: [
                      { category: { type: "asc" } },
                      { category: { sortOrder: "asc" } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const category = translation?.category;

  if (!category || !category.isActive) {
    return null;
  }

  const dto = toCategoryDto(category, locale);

  if (!dto) {
    return null;
  }

  const products = category.productCategories
    .map(({ product }) => product)
    .map((product) => toProductSummaryDto(product, locale))
    .filter((product): product is ProductSummaryDto => product !== undefined)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return {
    ...dto,
    products,
    slugsByLocale: toSlugsByLocale(category.translations),
  };
}

export const getMainCategories = cache(
  async (locale: Locale): Promise<MainCategoryDto[]> => {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { translations: true },
      orderBy: { sortOrder: "asc" },
    });

    const standard = categories.filter((category) => category.type !== "PROMOTIONAL");
    const promotional = categories.filter((category) => category.type === "PROMOTIONAL");

    return [...standard, ...promotional]
      .map((category) => {
        const translation = resolveTranslation(category.translations, locale);

        if (!translation) {
          return undefined;
        }

        return {
          id: category.id,
          slug: translation.slug,
          name: translation.name,
          description: translation.description,
        };
      })
      .filter((category): category is MainCategoryDto => category !== undefined);
  }
);

export async function getFilteredProducts(
  categorySlug: string,
  locale: Locale,
  filters: ProductAttributeFilter[],
  paging?: Paging
): Promise<ProductSummaryDto[]> {
  const { limit, offset } = resolvePaging(paging);

  const categoryFilter =
    categorySlug === "all"
      ? {}
      : {
          productCategories: {
            some: {
              category: {
                translations: { some: { locale, slug: categorySlug } },
              },
            },
          },
        };

  const attributeFilters = filters.map((filter) => ({
    attributes: {
      some: { key: filter.key, value: filter.value },
    },
  }));

  const products = await prisma.product.findMany({
    where: {
      ...categoryFilter,
      AND: attributeFilters,
    },
    include: {
      translations: true,
      images: true,
      variants: { include: { translations: true } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ category: { type: "asc" } }, { category: { sortOrder: "asc" } }],
      },
    },
    take: limit,
    skip: offset,
  });

  return products
    .map((product) => toProductSummaryDto(product, locale))
    .filter((product): product is ProductSummaryDto => product !== undefined)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

export async function getPageBySlug(
  slug: string,
  locale: Locale
): Promise<PageDto | null> {
  const translation = await prisma.pageTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { page: { include: { translations: true } } },
  });

  if (!translation) {
    return null;
  }

  const resolved = resolveTranslation(translation.page.translations, locale);

  if (!resolved) {
    return null;
  }

  return {
    key: translation.page.key,
    title: resolved.title,
    slug: resolved.slug,
    body: resolved.body,
    updatedAt: translation.page.updatedAt,
  };
}

export async function getArticles(
  locale: Locale,
  paging?: Paging
): Promise<ArticleSummaryDto[]> {
  const { limit, offset } = resolvePaging(paging);

  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    include: { translations: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    skip: offset,
  });

  return articles
    .map((article) => {
      const translation = resolveTranslation(article.translations, locale);

      if (!translation) {
        return undefined;
      }

      return {
        id: article.id,
        slug: translation.slug,
        title: translation.title,
        updatedAt: article.updatedAt,
      };
    })
    .filter((article): article is ArticleSummaryDto => article !== undefined);
}

export async function getArticleBySlug(
  slug: string,
  locale: Locale
): Promise<ArticleDetailDto | null> {
  const translation = await prisma.articleTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { article: { include: { translations: true } } },
  });

  const article = translation?.article;

  if (!article || !article.publishedAt) {
    return null;
  }

  const resolved = resolveTranslation(article.translations, locale);

  if (!resolved) {
    return null;
  }

  return {
    id: article.id,
    slug: resolved.slug,
    title: resolved.title,
    body: resolved.body,
    updatedAt: article.updatedAt,
  };
}

export async function getProductSlugs(locale: Locale): Promise<SlugEntryDto[]> {
  try {
    const translations = await prisma.productTranslation.findMany({
      where: { locale },
      select: { productId: true, slug: true, product: { select: { updatedAt: true } } },
      orderBy: { slug: "asc" },
    });

    return translations.map((translation) => ({
      id: translation.productId,
      slug: translation.slug,
      updatedAt: translation.product.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getCategorySlugs(locale: Locale): Promise<SlugEntryDto[]> {
  try {
    const translations = await prisma.categoryTranslation.findMany({
      where: { locale, category: { isActive: true } },
      select: { categoryId: true, slug: true, category: { select: { updatedAt: true } } },
      orderBy: { slug: "asc" },
    });

    return translations.map((translation) => ({
      id: translation.categoryId,
      slug: translation.slug,
      updatedAt: translation.category.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getArticleSlugs(locale: Locale): Promise<SlugEntryDto[]> {
  try {
    const translations = await prisma.articleTranslation.findMany({
      where: { locale, article: { publishedAt: { not: null } } },
      select: { articleId: true, slug: true, article: { select: { updatedAt: true } } },
      orderBy: { slug: "asc" },
    });

    return translations.map((translation) => ({
      id: translation.articleId,
      slug: translation.slug,
      updatedAt: translation.article.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getOrdersForUser(userId: string): Promise<OrderDto[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
  }));
}
