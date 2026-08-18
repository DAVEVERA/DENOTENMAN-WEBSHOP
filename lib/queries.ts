import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { defaultLocale, type Locale } from "@/lib/i18n";
import { publicImageUrl } from "@/lib/storage";
import { resolveProductDisplayPrice } from "@/lib/product-price";
import {
  buildCategoryNavigation,
  type CategoryNavigationDto,
  type NavigationCategorySourceDto,
} from "@/lib/categoryGroups";
import type {
  Category,
  CategoryTranslation,
  CategoryType,
  Product,
  ProductAttribute,
  ProductCategory,
  ProductImage,
  ProductTranslation,
  ProductVariant,
  VariantTranslation,
  Prisma,
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
  regularPriceCents: number;
  salePriceCents: number | null;
  stock: number;
  weightGrams: number;
  preparation: string;
  salting: string;
  coating: string;
  label: string | null;
};

export type ProductSummaryDto = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  descriptionHtml: string | null;
  shortDescription: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  promotionText: string | null;
  basePriceCents: number;
  regularBasePriceCents: number;
  salePriceCents: number | null;
  hasVariablePrice: boolean;
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
  recommendations: ProductRecommendationDto[];
};

export type ProductRecommendationDto = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  image: ProductImageDto | null;
  variant: ProductVariantDto | null;
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
  type: CategoryType;
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
  slugsByLocale: Partial<Record<Locale, string>>;
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

export type ProductSitemapEntryDto = SlugEntryDto & {
  images: string[];
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

  const variants = product.variants
    .filter((variant) => variant.isActive)
    .map((variant) => toProductVariantDto(variant, locale));
  const displayPrice = resolveProductDisplayPrice(
    product.basePriceCents,
    product.salePriceCents,
    variants
  );

  return {
    id: product.id,
    sku: product.sku,
    slug: translation.slug,
    name: translation.name,
    description: translation.description,
    descriptionHtml: translation.descriptionHtml,
    shortDescription:
      toShortDescription(translation.shortDescription) ??
      toShortDescription(translation.description),
    seoTitle: translation.seoTitle,
    metaDescription: translation.metaDescription,
    promotionText: translation.promotionText,
    basePriceCents: displayPrice.priceCents,
    regularBasePriceCents: displayPrice.regularPriceCents,
    salePriceCents: displayPrice.salePriceCents,
    hasVariablePrice: displayPrice.hasVariablePrice,
    currency: product.currency,
    unit: product.unit,
    isActive: product.isActive,
    images: product.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toProductImageDto),
    variants,
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
    priceCents: variant.salePriceCents ?? variant.priceCents,
    regularPriceCents: variant.priceCents,
    salePriceCents: variant.salePriceCents,
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

export const getProductBySlug = cache(async function getProductBySlug(
  slug: string,
  locale: Locale
): Promise<ProductDetailDto | null> {
  const translation = await prisma.productTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    select: { productId: true },
  });
  const alias = translation
    ? null
    : await prisma.productSlugAlias.findUnique({
        where: { locale_slug: { locale, slug } },
        select: { productId: true },
      });
  const productId = translation?.productId ?? alias?.productId;
  if (!productId) return null;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      images: true,
      variants: { include: { translations: true } },
      attributes: true,
      recommendations: { orderBy: { sortOrder: "asc" }, select: { targetProductId: true } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { category: { sortOrder: "asc" } }],
      },
    },
  });

  if (!product || !product.isActive) {
    return null;
  }

  const summary = toProductSummaryDto(product, locale);

  if (!summary) {
    return null;
  }

  const manualIds = product.recommendations.map((item) => item.targetProductId);
  const categoryIds = product.productCategories.map((item) => item.categoryId);
  const recommendationInclude = {
    include: {
      translations: true,
      images: true,
      variants: { where: { isActive: true }, include: { translations: true } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { category: { sortOrder: "asc" } }],
      },
    },
  } satisfies Prisma.ProductFindManyArgs;
  const manualCandidates = manualIds.length
    ? await prisma.product.findMany({
        where: { id: { in: manualIds }, isActive: true },
        ...recommendationInclude,
      })
    : [];
  const categoryCandidates = manualCandidates.length >= 3 || !categoryIds.length
    ? []
    : await prisma.product.findMany({
        where: {
          id: { notIn: [product.id, ...manualCandidates.map((item) => item.id)] },
          isActive: true,
          productCategories: { some: { categoryId: { in: categoryIds } } },
        },
        take: 3 - manualCandidates.length,
        ...recommendationInclude,
      });
  const selectedCandidates = [...manualCandidates, ...categoryCandidates];
  const generalCandidates = selectedCandidates.length >= 3
    ? []
    : await prisma.product.findMany({
        where: { id: { notIn: [product.id, ...selectedCandidates.map((item) => item.id)] }, isActive: true },
        take: 3 - selectedCandidates.length,
        ...recommendationInclude,
      });
  const candidates = [...selectedCandidates, ...generalCandidates];
  const manualOrder = new Map(manualIds.map((id, index) => [id, index]));
  const recommendationSummaries = candidates
    .map((candidate) => toProductSummaryDto(candidate, locale))
    .filter((candidate): candidate is ProductSummaryDto => Boolean(candidate))
    .sort((left, right) => {
      const leftOrder = manualOrder.get(left.id) ?? 1000;
      const rightOrder = manualOrder.get(right.id) ?? 1000;
      return leftOrder - rightOrder || left.name.localeCompare(right.name, locale);
    })
    .slice(0, 3)
    .map((candidate) => ({
      id: candidate.id,
      slug: candidate.slug,
      name: candidate.name,
      shortDescription: candidate.shortDescription,
      image: candidate.images.find((image) => image.isPrimary) ?? candidate.images[0] ?? null,
      variant: [...candidate.variants].sort((left, right) => left.weightGrams - right.weightGrams)[0] ?? null,
    }));

  return {
    ...summary,
    slugsByLocale: toSlugsByLocale(product.translations),
    attributes: toProductAttributesDto(product.attributes, locale),
    recommendations: recommendationSummaries,
  };
});

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
            where: { product: { isActive: true } },
            include: {
              product: {
                include: {
                  translations: true,
                  images: true,
                  variants: { include: { translations: true } },
                  productCategories: {
                    include: { category: { include: { translations: true } } },
                    orderBy: [
                      { isPrimary: "desc" },
                      { sortOrder: "asc" },
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

  const products = [...category.productCategories]
    .sort((left, right) =>
      Number(right.product.isActive) - Number(left.product.isActive) ||
      left.sortOrder - right.sortOrder ||
      left.product.slug.localeCompare(right.product.slug, locale)
    )
    .map(({ product }) => product)
    .map((product) => toProductSummaryDto(product, locale))
    .filter((product): product is ProductSummaryDto => product !== undefined);

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
          type: category.type,
        };
      })
      .filter((category): category is MainCategoryDto => category !== undefined);
  }
);

export const getCategoryNavigation = cache(
  async (locale: Locale): Promise<CategoryNavigationDto> => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: { translations: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });

    const localized = categories
      .map((category): NavigationCategorySourceDto | undefined => {
        const translation = resolveTranslation(category.translations, locale);
        if (!translation) return undefined;

        return {
          id: category.id,
          canonicalSlug: category.slug,
          slug: translation.slug,
          name: translation.name,
          description: translation.description,
          type: category.type,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
        };
      })
      .filter(
        (category): category is NavigationCategorySourceDto => category !== undefined
      );

    return buildCategoryNavigation(localized);
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
      isActive: true,
      ...categoryFilter,
      AND: attributeFilters,
    },
    include: {
      translations: true,
      images: true,
      variants: { include: { translations: true } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { category: { sortOrder: "asc" } }],
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
    slugsByLocale: toSlugsByLocale(article.translations),
  };
}

export async function getProductSlugs(locale: Locale): Promise<SlugEntryDto[]> {
  try {
    const translations = await prisma.productTranslation.findMany({
      where: { locale, product: { isActive: true } },
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

export async function getProductSitemapSlugs(
  locale: Locale
): Promise<ProductSitemapEntryDto[]> {
  try {
    const translations = await prisma.productTranslation.findMany({
      where: { locale, product: { isActive: true } },
      select: {
        productId: true,
        slug: true,
        product: {
          select: {
            updatedAt: true,
            images: {
              select: { storageKey: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
            },
          },
        },
      },
      orderBy: { slug: "asc" },
    });

    return translations.map((translation) => ({
      id: translation.productId,
      slug: translation.slug,
      updatedAt: translation.product.updatedAt,
      images: translation.product.images.map((image) => publicImageUrl(image.storageKey)),
    }));
  } catch (error) {
    console.error("Failed to load product sitemap entries", { locale, error });
    return [];
  }
}

export async function getCategorySlugs(locale: Locale): Promise<SlugEntryDto[]> {
  try {
    const translations = await prisma.categoryTranslation.findMany({
      where: { locale, category: { isActive: true } },
      select: {
        categoryId: true,
        slug: true,
        category: {
          select: {
            updatedAt: true,
            productCategories: {
              where: { product: { isActive: true } },
              select: { product: { select: { updatedAt: true } } },
            },
          },
        },
      },
      orderBy: { slug: "asc" },
    });

    return translations.map((translation) => ({
      id: translation.categoryId,
      slug: translation.slug,
      updatedAt: translation.category.productCategories.reduce(
        (latest, assignment) =>
          assignment.product.updatedAt > latest
            ? assignment.product.updatedAt
            : latest,
        translation.category.updatedAt
      ),
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
