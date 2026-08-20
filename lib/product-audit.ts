import { prisma } from "@/lib/prisma";
import {
  auditLocales,
  buildDeterministicProductAudit,
  generateStructuredProductProposals,
  type AuditLocale,
  type ProductAuditAiBoundary,
  type ProductAuditSnapshot,
} from "@/lib/product-audit-core";
import { createOpenAIProductAuditBoundary } from "@/lib/product-audit-openai";
import {
  auditRenderedProductPages,
  type RenderedProductPageTarget,
} from "@/lib/rendered-product-page-audit";
import { BASE_URL, product as productPath } from "@/lib/routes";

function isAuditLocale(locale: string): locale is AuditLocale {
  return auditLocales.some((candidate) => candidate === locale);
}

export function buildRenderedProductPageTargets(
  translations: Array<{ locale: AuditLocale; slug: string; name: string }>
): RenderedProductPageTarget[] {
  return translations
    .filter((translation) => translation.slug.trim() && translation.name.trim())
    .map((translation) => ({
      locale: translation.locale,
      path: productPath(translation.locale, translation.slug),
      productName: translation.name,
    }));
}

export function buildProductRevalidationPath(locale: AuditLocale, slug: string): string {
  return productPath(locale, slug);
}

export async function loadProductAuditSnapshot(productId: string): Promise<ProductAuditSnapshot | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      variants: { orderBy: { id: "asc" } },
      productCategories: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        include: { category: { include: { translations: { where: { locale: "nl" }, take: 1 } } } },
      },
      recommendations: { orderBy: { sortOrder: "asc" } },
      attributes: { orderBy: { key: "asc" } },
    },
  });
  if (!product) return null;

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    basePriceCents: product.basePriceCents,
    salePriceCents: product.salePriceCents,
    currency: product.currency,
    unit: product.unit,
    isActive: product.isActive,
    translations: product.translations
      .filter((translation) => isAuditLocale(translation.locale))
      .map((translation) => ({
        locale: translation.locale as AuditLocale,
        name: translation.name,
        slug: translation.slug,
        shortDescription: translation.shortDescription,
        shortDescriptionHtml: translation.shortDescriptionHtml,
        description: translation.description,
        descriptionHtml: translation.descriptionHtml,
        seoTitle: translation.seoTitle,
        metaDescription: translation.metaDescription,
        promotionText: translation.promotionText,
      })),
    images: product.images.map(({ id, alt, sortOrder, isPrimary }) => ({ id, alt, sortOrder, isPrimary })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      priceCents: variant.priceCents,
      salePriceCents: variant.salePriceCents,
      stock: variant.stock,
      weightGrams: variant.weightGrams,
      preparation: variant.preparation,
      salting: variant.salting,
      coating: variant.coating,
      isActive: variant.isActive,
    })),
    categories: product.productCategories.map((assignment) => ({
      id: assignment.categoryId,
      slug: assignment.category.slug,
      name: assignment.category.translations[0]?.name ?? assignment.category.slug,
      parentId: assignment.category.parentId,
      isPrimary: assignment.isPrimary,
      sortOrder: assignment.sortOrder,
    })),
    recommendations: product.recommendations.map(({ targetProductId, sortOrder }) => ({ targetProductId, sortOrder })),
    attributes: product.attributes.map(({ key, value }) => ({ key, value })),
  };
}

export async function buildProductAudit(productId: string) {
  const snapshot = await loadProductAuditSnapshot(productId);
  if (!snapshot) return null;
  const renderedPages = await auditRenderedProductPages(
    buildRenderedProductPageTargets(snapshot.translations),
    { baseUrl: BASE_URL }
  );
  return {
    ...buildDeterministicProductAudit(snapshot),
    renderedPages,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

export async function generateProductAuditProposals(
  productId: string,
  boundary: ProductAuditAiBoundary = createOpenAIProductAuditBoundary()
) {
  const snapshot = await loadProductAuditSnapshot(productId);
  if (!snapshot) throw new Error("PRODUCT_NOT_FOUND");
  const renderedPages = await auditRenderedProductPages(
    buildRenderedProductPageTargets(snapshot.translations),
    { baseUrl: BASE_URL }
  );
  return generateStructuredProductProposals(snapshot, boundary, renderedPages);
}

export type { DeterministicProductAudit, ProductContentProposalSet } from "@/lib/product-audit-core";
