import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { ProductEditForm } from "./ProductEditForm";
import { ProductEditorNav } from "@/components/admin-panel/ProductEditorNav";
import { sanitizeProductHtml, sanitizeProductShortHtml } from "@/lib/product-content";

const productLocales = ["nl", "en", "fr"] as const;

function plainTextEditorHtml(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  return `<p>${escaped.replace(/\r?\n/g, "<br>")}</p>`;
}

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, productOptions] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
      translations: true,
      attributes: true,
      images: true,
      variants: { include: { translations: true }, orderBy: { sku: "asc" } },
      recommendations: { orderBy: { sortOrder: "asc" } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { category: { sortOrder: "asc" } }],
      },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      include: { translations: { where: { locale: "nl" } } },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({
      where: { translations: { some: { locale: "nl" } } },
      include: { translations: { where: { locale: "nl" } } },
      orderBy: { slug: "asc" },
    }),
  ]);

  if (!product) {
    notFound();
  }

  const nlTranslation = product.translations.find((translation) => translation.locale === "nl");

  const activeCategoryLink =
    product.productCategories.find((link) => link.category.isActive) ?? product.productCategories[0];
  const categoryName =
    activeCategoryLink?.category.translations.find((translation) => translation.locale === "nl")
      ?.name ?? null;

  const images = [...product.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({
      id: image.id,
      url: publicImageUrl(image.storageKey),
      alt: image.alt ?? "",
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    }));

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: variant.translations.find((translation) => translation.locale === "nl")?.label ?? "",
    clientKey: variant.id,
    weightGrams: String(variant.weightGrams),
    preparation: variant.preparation,
    salting: variant.salting,
    coating: variant.coating,
    isActive: variant.isActive,
    priceEuro: (variant.priceCents / 100).toFixed(2),
    salePriceEuro: variant.salePriceCents === null ? "" : (variant.salePriceCents / 100).toFixed(2),
    stock: String(variant.stock),
  }));

  const categoryOptions = categories
    .map((category) => ({ id: category.id, parentId: category.parentId, name: category.translations[0]?.name }))
    .filter((category): category is { id: string; parentId: string | null; name: string } => Boolean(category.name));
  const recommendationOptions = productOptions
    .map((item) => ({ id: item.id, name: item.translations[0]?.name }))
    .filter((item): item is { id: string; name: string } => Boolean(item.name));
  const translationDraft = (locale: (typeof productLocales)[number]) => {
    const translation = product.translations.find((item) => item.locale === locale);
    return {
      locale,
      slug: translation?.slug ?? "",
      name: translation?.name ?? "",
      shortDescription: translation?.shortDescription ?? "",
      shortDescriptionHtml:
        sanitizeProductShortHtml(translation?.shortDescriptionHtml) ||
        plainTextEditorHtml(translation?.shortDescription),
      description: translation?.description ?? "",
      descriptionHtml:
        sanitizeProductHtml(translation?.descriptionHtml) ||
        plainTextEditorHtml(translation?.description),
      seoTitle: translation?.seoTitle ?? "",
      metaDescription: translation?.metaDescription ?? "",
      promotionText: translation?.promotionText ?? "",
    };
  };
  const translations = {
    nl: translationDraft("nl"),
    en: translationDraft("en"),
    fr: translationDraft("fr"),
  };
  const attributeValues = new Map(product.attributes.map((attribute) => [attribute.key, attribute.value]));
  const nutrition = {
    "nutrition.energyKj": attributeValues.get("nutrition.energyKj") ?? "",
    "nutrition.energyKcal": attributeValues.get("nutrition.energyKcal") ?? "",
    "nutrition.fat": attributeValues.get("nutrition.fat") ?? "",
    "nutrition.saturatedFat": attributeValues.get("nutrition.saturatedFat") ?? "",
    "nutrition.carbohydrates": attributeValues.get("nutrition.carbohydrates") ?? "",
    "nutrition.sugars": attributeValues.get("nutrition.sugars") ?? "",
    "nutrition.fiber": attributeValues.get("nutrition.fiber") ?? "",
    "nutrition.protein": attributeValues.get("nutrition.protein") ?? "",
    "nutrition.salt": attributeValues.get("nutrition.salt") ?? "",
    ingredients: attributeValues.get("ingredients") ?? "",
    allergens: attributeValues.get("allergens") ?? "",
    mayContainTraces: attributeValues.get("mayContainTraces") ?? "",
  };
  const categoryAssignments = product.productCategories.map((link) => ({
    categoryId: link.categoryId,
    isPrimary: link.isPrimary,
    sortOrder: link.sortOrder,
  }));
  const initialProduct = {
    version: product.updatedAt.toISOString(),
    sku: product.sku,
    slug: nlTranslation?.slug ?? product.slug,
    name: nlTranslation?.name ?? "",
    shortDescription: nlTranslation?.shortDescription ?? "",
    description: nlTranslation?.description ?? "",
    basePriceEuro: (product.basePriceCents / 100).toFixed(2),
    salePriceEuro: product.salePriceCents === null ? "" : (product.salePriceCents / 100).toFixed(2),
    unit: product.unit,
    isActive: product.isActive,
    categoryIds: categoryAssignments.map((category) => category.categoryId),
    recommendationIds: product.recommendations.map((item) => item.targetProductId),
    variants,
    translations,
    nutrition,
    categories: categoryAssignments,
    imageOrder: images.map(({ id: imageId, sortOrder, isPrimary }) => ({ imageId, sortOrder, isPrimary })),
  };

  return (
    <div>
      <Link
        href="/admin/producten"
        className="inline-flex min-h-11 items-center text-body-sm font-semibold text-text underline decoration-accent underline-offset-4"
      >
        ← Terug naar producten
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="break-words text-heading-xl text-text [overflow-wrap:anywhere]">
            {nlTranslation?.name ?? product.slug}
          </h1>
          <p className="mt-1 text-body-sm text-muted">
            SKU {product.sku} · Slug {product.slug}
            {categoryName ? ` · ${categoryName}` : ""}
          </p>
        </div>
      </div>

      <ProductEditorNav productId={product.id} active="product" />

      <div className="mt-8">
        <ProductEditForm
          mode="edit"
          productId={product.id}
          initial={initialProduct}
          categories={categoryOptions}
          productOptions={recommendationOptions}
          images={images}
        />
      </div>
    </div>
  );
}
