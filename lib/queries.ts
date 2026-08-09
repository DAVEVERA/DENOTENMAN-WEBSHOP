import { prisma } from "@/lib/prisma";
import { defaultLocale, type Locale } from "@/lib/i18n";
import { publicImageUrl } from "@/lib/storage";
import type {
  Category,
  CategoryTranslation,
  Product,
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
  basePriceCents: number;
  currency: string;
  images: ProductImageDto[];
  updatedAt: Date;
};

export type ProductDetailDto = ProductSummaryDto & {
  variants: ProductVariantDto[];
  slugsByLocale: Partial<Record<Locale, string>>;
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
const maxPageLimit = 100;
const defaultPageOffset = 0;

function resolvePaging(paging?: Paging): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(paging?.limit ?? defaultPageLimit, 1),
    maxPageLimit
  );
  const offset = Math.max(paging?.offset ?? defaultPageOffset, 0);

  return { limit, offset };
}

function resolveTranslation<T extends { locale: Locale }>(
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
    basePriceCents: product.basePriceCents,
    currency: product.currency,
    images: product.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toProductImageDto),
    updatedAt: product.updatedAt,
  };
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
    stock: variant.stock,
    weightGrams: variant.weightGrams,
    preparation: variant.preparation,
    salting: variant.salting,
    coating: variant.coating,
    label: translation?.label ?? null,
  };
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
        },
      },
    },
  });

  const product = translation?.product;

  if (!product || !product.isActive) {
    return null;
  }

  const summary = toProductSummaryDto(product, locale);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    variants: product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => toProductVariantDto(variant, locale)),
    slugsByLocale: toSlugsByLocale(product.translations),
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
                include: { translations: true, images: true },
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
    .filter((product) => product.isActive)
    .map((product) => toProductSummaryDto(product, locale))
    .filter((product): product is ProductSummaryDto => product !== undefined);

  return {
    ...dto,
    products,
    slugsByLocale: toSlugsByLocale(category.translations),
  };
}

export async function getMainCategories(locale: Locale): Promise<MainCategoryDto[]> {
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
      };
    })
    .filter((category): category is MainCategoryDto => category !== undefined);
}

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
    include: { translations: true, images: true },
    take: limit,
    skip: offset,
  });

  return products
    .map((product) => toProductSummaryDto(product, locale))
    .filter((product): product is ProductSummaryDto => product !== undefined);
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
