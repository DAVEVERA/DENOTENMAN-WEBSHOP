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
import { notifyPendingStockSubscribers } from "@/lib/stock-notifications";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "CONFLICT", message: "Deze slug of SKU is al in gebruik." }, { status: 409 });
  }
  console.error("Failed to update product", error);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
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
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = productAdminInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.recommendationIds.includes(id)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Een product kan zichzelf niet als meepakker hebben." }, { status: 400 });
  }

  const input = parsed.data;
  const translations = getProductTranslations(input);
  const requestedCategories = getProductCategories(input);
  const requestedCategoryIds = requestedCategories.map((category) => category.categoryId);
  let shouldNotify = false;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id },
        include: {
          variants: { select: { id: true } },
          translations: true,
          productCategories: true,
        },
      });
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (input.version && current.updatedAt.toISOString() !== input.version) throw new Error("STALE_PRODUCT");

      const categories = await tx.category.findMany({
        where: { id: { in: requestedCategoryIds } },
        select: { id: true, parentId: true },
      });
      if (categories.length !== requestedCategoryIds.length) throw new Error("CATEGORY_NOT_FOUND");
      for (const category of categories) {
        if (category.parentId && !requestedCategoryIds.includes(category.parentId)) {
          throw new Error("CATEGORY_PARENT_REQUIRED");
        }
      }
      if (await tx.product.count({ where: { id: { in: input.recommendationIds } } }) !== input.recommendationIds.length) {
        throw new Error("RECOMMENDATION_NOT_FOUND");
      }

      const knownVariantIds = new Set(current.variants.map((variant) => variant.id));
      for (const variant of input.variants) {
        if (variant.id && !knownVariantIds.has(variant.id)) throw new Error("VARIANT_NOT_FOUND");
      }

      for (const translation of translations) {
        const claimedAlias = await tx.productSlugAlias.findUnique({
          where: { locale_slug: { locale: translation.locale, slug: translation.slug } },
        });
        if (claimedAlias && claimedAlias.productId !== id) throw new Error("SLUG_ALIAS_CONFLICT");
        if (claimedAlias?.productId === id) {
          await tx.productSlugAlias.delete({ where: { id: claimedAlias.id } });
        }

        const previous = current.translations.find((item) => item.locale === translation.locale);
        if (previous && previous.slug !== translation.slug) {
          const existingAlias = await tx.productSlugAlias.findUnique({
            where: { locale_slug: { locale: translation.locale, slug: previous.slug } },
          });
          if (existingAlias && existingAlias.productId !== id) throw new Error("SLUG_ALIAS_CONFLICT");
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error) {
      const statusByMessage: Record<string, number> = {
        PRODUCT_NOT_FOUND: 404,
        CATEGORY_NOT_FOUND: 400,
        CATEGORY_PARENT_REQUIRED: 400,
        RECOMMENDATION_NOT_FOUND: 400,
        VARIANT_NOT_FOUND: 404,
        STALE_PRODUCT: 409,
        SLUG_ALIAS_CONFLICT: 409,
      };
      const status = statusByMessage[error.message];
      if (status) return NextResponse.json({ error: error.message }, { status });
    }
    return errorResponse(error);
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
  });
}
