import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import {
  getProductCategories,
  getProductTranslations,
  normalizeOptionalText,
  productAdminInputSchema,
  type ProductCategoryInput,
  type ProductNutritionInput,
  type ProductTranslationInput,
} from "@/lib/admin-product-schema";
import { toProductPlainText } from "@/lib/product-content";
import { revalidateProductStorefront } from "@/lib/product-revalidation";
import {
  buildProductIndexNowUrls,
  scheduleIndexNowUrls,
} from "@/lib/indexnow";
import { BASE_URL } from "@/lib/routes";
import type { ProductRevalidationInput } from "@/lib/product-visibility";
import { notifyPendingStockSubscribers } from "@/lib/stock-notifications";
import { prisma } from "@/lib/prisma";
import {
  AdminProductMutationError,
  adminProductErrorContract,
  planVariantPersistence,
  validationErrorContract,
} from "@/lib/admin-product-save-contract";

export { planVariantPersistence, validationErrorContract } from "@/lib/admin-product-save-contract";

function jsonError(
  code: Parameters<typeof adminProductErrorContract>[0],
  options?: Parameters<typeof adminProductErrorContract>[1],
) {
  const contract = adminProductErrorContract(code, options);
  return NextResponse.json(contract.body, { status: contract.status });
}

function conflictTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.join(" ").toLowerCase();
  return typeof target === "string" ? target.toLowerCase() : "";
}

function errorResponse(error: unknown, requestId: string, productId: string) {
  if (error instanceof AdminProductMutationError) {
    return jsonError(error.code === "VALIDATION_ERROR" ? "INTERNAL_ERROR" : error.code, {
      field: error.field,
      variantSku: error.variantSku,
      requestId,
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = conflictTarget(error);
    if (error.meta?.modelName === "ProductVariant" || target.includes("productvariant")) {
      return jsonError("VARIANT_SKU_CONFLICT");
    }
    if (target.includes("slug") || error.meta?.modelName === "ProductTranslation") {
      return jsonError("SLUG_CONFLICT");
    }
    return jsonError("SKU_CONFLICT");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return jsonError("STALE_PRODUCT");
  }
  console.error("Failed to update product", { requestId, productId, error });
  return jsonError("INTERNAL_ERROR", { requestId });
}

function translationData(translation: ProductTranslationInput) {
  return {
    name: translation.name,
    slug: translation.slug,
    shortDescription: normalizeOptionalText(translation.shortDescription),
    description: translation.descriptionHtml
      ? normalizeOptionalText(toProductPlainText(translation.descriptionHtml))
      : normalizeOptionalText(translation.description),
    descriptionHtml: translation.descriptionHtml,
    seoTitle: normalizeOptionalText(translation.seoTitle),
    metaDescription: normalizeOptionalText(translation.metaDescription),
    promotionText: normalizeOptionalText(translation.promotionText),
  };
}

async function upsertNutrition(
  tx: Prisma.TransactionClient,
  productId: string,
  nutrition: ProductNutritionInput | undefined
) {
  if (!nutrition) return;
  for (const [key, value] of Object.entries(nutrition)) {
    if (value === undefined) continue;
    if (value === null) {
      await tx.productAttribute.deleteMany({ where: { productId, key } });
      continue;
    }
    await tx.productAttribute.upsert({
      where: { productId_key: { productId, key } },
      update: { value },
      create: { productId, key, value },
    });
  }
}

async function resolveCategoryAssignments(
  tx: Prisma.TransactionClient,
  requested: ProductCategoryInput[],
  current: ProductCategoryInput[],
  explicitAssignments: boolean
): Promise<ProductCategoryInput[]> {
  if (explicitAssignments) return requested;

  const currentByCategory = new Map(current.map((category) => [category.categoryId, category]));
  const retainedPrimary = current.find((category) =>
    category.isPrimary && requested.some((requestedCategory) => requestedCategory.categoryId === category.categoryId)
  )?.categoryId;
  const primaryCategoryId = retainedPrimary ?? requested[0]?.categoryId;

  return Promise.all(requested.map(async (category) => {
    const existing = currentByCategory.get(category.categoryId);
    if (existing) {
      return { ...existing, isPrimary: category.categoryId === primaryCategoryId };
    }
    const maximum = await tx.productCategory.aggregate({
      where: { categoryId: category.categoryId },
      _max: { sortOrder: true },
    });
    return {
      categoryId: category.categoryId,
      isPrimary: category.categoryId === primaryCategoryId,
      sortOrder: (maximum._max.sortOrder ?? -1) + 1,
    };
  }));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) {
    return jsonError("UNAUTHORIZED");
  }

  const { id } = await params;
  const requestId = crypto.randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON");
  }
  const parsed = productAdminInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationErrorContract(parsed.error.issues), { status: 400 });
  }
  if (!parsed.data.version) {
    return jsonError("VERSION_REQUIRED");
  }
  if (parsed.data.recommendationIds.includes(id)) {
    return jsonError("RECOMMENDATION_SELF");
  }

  const input = parsed.data;
  const translations = getProductTranslations(input);
  const requestedCategories = getProductCategories(input);
  const requestedCategoryIds = requestedCategories.map((category) => category.categoryId);
  let shouldNotify = false;
  let shouldSubmitIndexNow = false;
  let revalidationContext: ProductRevalidationInput | null = null;

  try {
    revalidationContext = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id },
        include: {
          variants: { select: { id: true, sku: true, _count: { select: { orderItems: true } } } },
          translations: true,
          productCategories: {
            include: {
              category: {
                select: { translations: { select: { locale: true, slug: true } } },
              },
            },
          },
        },
      });
      if (!current) throw new AdminProductMutationError("PRODUCT_NOT_FOUND");
      if (current.updatedAt.toISOString() !== input.version) {
        throw new AdminProductMutationError("STALE_PRODUCT", { field: "version" });
      }

      const categories = await tx.category.findMany({
        where: { id: { in: requestedCategoryIds } },
        select: {
          id: true,
          parentId: true,
          translations: { select: { locale: true, slug: true } },
        },
      });
      if (categories.length !== requestedCategoryIds.length) {
        throw new AdminProductMutationError("CATEGORY_NOT_FOUND", { field: "categories" });
      }
      for (const category of categories) {
        if (category.parentId && !requestedCategoryIds.includes(category.parentId)) {
          throw new AdminProductMutationError("CATEGORY_PARENT_REQUIRED", { field: "categories" });
        }
      }
      if (await tx.product.count({ where: { id: { in: input.recommendationIds } } }) !== input.recommendationIds.length) {
        throw new AdminProductMutationError("RECOMMENDATION_NOT_FOUND", { field: "recommendationIds" });
      }

      const variantPlan = planVariantPersistence(
        current.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          orderItemCount: variant._count.orderItems,
        })),
        input.variants,
      );

      for (const translation of translations) {
        const claimedAlias = await tx.productSlugAlias.findUnique({
          where: { locale_slug: { locale: translation.locale, slug: translation.slug } },
        });
        if (claimedAlias && claimedAlias.productId !== id) {
          throw new AdminProductMutationError("SLUG_CONFLICT", {
            field: `translations.${translations.indexOf(translation)}.slug`,
          });
        }
        if (claimedAlias?.productId === id) {
          await tx.productSlugAlias.delete({ where: { id: claimedAlias.id } });
        }

        const previous = current.translations.find((item) => item.locale === translation.locale);
        if (previous && previous.slug !== translation.slug) {
          const existingAlias = await tx.productSlugAlias.findUnique({
            where: { locale_slug: { locale: translation.locale, slug: previous.slug } },
          });
          if (existingAlias && existingAlias.productId !== id) {
            throw new AdminProductMutationError("SLUG_CONFLICT", {
              field: `translations.${translations.indexOf(translation)}.slug`,
            });
          }
          if (!existingAlias) {
            await tx.productSlugAlias.create({
              data: { productId: id, locale: translation.locale, slug: previous.slug },
            });
          }
        }
      }

      const nlTranslation = translations.find((translation) => translation.locale === "nl");
      await tx.product.update({
        where: { id },
        data: {
          sku: input.sku,
          slug: nlTranslation?.slug ?? current.slug,
          basePriceCents: input.basePriceCents,
          salePriceCents: input.salePriceCents,
          unit: input.unit,
          isActive: input.isActive,
        },
      });

      for (const translation of translations) {
        const data = translationData(translation);
        await tx.productTranslation.upsert({
          where: { productId_locale: { productId: id, locale: translation.locale } },
          update: data,
          create: { productId: id, locale: translation.locale, ...data },
        });
      }

      const currentCategories = current.productCategories.map((category) => ({
        categoryId: category.categoryId,
        isPrimary: category.isPrimary,
        sortOrder: category.sortOrder,
      }));
      const categoryAssignments = await resolveCategoryAssignments(
        tx,
        requestedCategories,
        currentCategories,
        Boolean(input.categories) && input.categoryPlacementMode === "manual"
      );
      await tx.productCategory.updateMany({ where: { productId: id }, data: { isPrimary: false } });
      await tx.productCategory.deleteMany({
        where: { productId: id, categoryId: { notIn: requestedCategoryIds } },
      });
      for (const category of categoryAssignments) {
        await tx.productCategory.upsert({
          where: { productId_categoryId: { productId: id, categoryId: category.categoryId } },
          update: { isPrimary: category.isPrimary, sortOrder: category.sortOrder },
          create: { productId: id, ...category },
        });
      }

      await tx.productRecommendation.deleteMany({ where: { sourceProductId: id } });
      if (input.recommendationIds.length) {
        await tx.productRecommendation.createMany({
          data: input.recommendationIds.map((targetProductId, sortOrder) => ({
            sourceProductId: id,
            targetProductId,
            sortOrder,
          })),
        });
      }

      if (variantPlan.deleteIds.length) {
        await tx.variantTranslation.deleteMany({
          where: { variantId: { in: variantPlan.deleteIds } },
        });
        await tx.productVariant.deleteMany({
          where: { productId: id, id: { in: variantPlan.deleteIds } },
        });
      }

      for (const variant of input.variants) {
        const label = variant.label ?? `${variant.weightGrams} ${input.unit === "VOLUME" ? "ml" : "g"}`;
        if (variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              weightGrams: variant.weightGrams,
              preparation: variant.preparation,
              salting: variant.salting,
              coating: variant.coating,
              isActive: variant.isActive,
              priceCents: variant.priceCents,
              salePriceCents: variant.salePriceCents,
              stock: variant.stock,
            },
          });
          await tx.variantTranslation.upsert({
            where: { variantId_locale: { variantId: variant.id, locale: "nl" } },
            update: { label },
            create: { variantId: variant.id, locale: "nl", label },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: variant.sku,
              weightGrams: variant.weightGrams,
              preparation: variant.preparation,
              salting: variant.salting,
              coating: variant.coating,
              isActive: variant.isActive,
              priceCents: variant.priceCents,
              salePriceCents: variant.salePriceCents,
              stock: variant.stock,
              translations: { create: { locale: "nl", label } },
            },
          });
        }
      }

      await upsertNutrition(tx, id, input.nutrition);
      shouldNotify = !current.isActive && input.isActive;
      shouldSubmitIndexNow = current.isActive || input.isActive;
      return {
        productId: id,
        translations: [
          ...current.translations.map(({ locale, slug }) => ({ locale, slug })),
          ...translations.map(({ locale, slug }) => ({ locale, slug })),
        ],
        categoryTranslations: [
          ...current.productCategories.flatMap(
            (assignment) => assignment.category.translations
          ),
          ...categories.flatMap((category) => category.translations),
        ],
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return errorResponse(error, requestId, id);
  }

  if (!revalidationContext) {
    console.error("Product revalidation context missing", { requestId, productId: id });
    return jsonError("INTERNAL_ERROR", { requestId });
  }
  const revalidation = revalidateProductStorefront(revalidationContext);
  if (shouldSubmitIndexNow) {
    scheduleIndexNowUrls(buildProductIndexNowUrls({
      baseUrl: BASE_URL,
      translations: revalidationContext.translations,
      categoryTranslations: revalidationContext.categoryTranslations,
    }));
  }

  if (shouldNotify) {
    await notifyPendingStockSubscribers(id).catch((error) =>
      console.error(`Stock notification run failed for ${id}`, error)
    );
  }
  const updated = await prisma.product.findUnique({
    where: { id },
    select: {
      updatedAt: true,
      variants: { select: { id: true, sku: true }, orderBy: { sku: "asc" } },
      images: { select: { id: true, sortOrder: true, isPrimary: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({
    ok: true,
    version: updated?.updatedAt.toISOString(),
    variants: updated?.variants ?? [],
    images: updated?.images ?? [],
    frontendSynced: revalidation.frontendSynced,
  });
}
