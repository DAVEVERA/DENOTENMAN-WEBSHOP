import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import {
  getProductCategories,
  getProductTranslations,
  normalizeOptionalText,
  productAdminInputSchema,
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
import { prisma } from "@/lib/prisma";

function translationData(translation: ProductTranslationInput) {
  return {
    locale: translation.locale,
    name: translation.name,
    slug: translation.slug,
    shortDescription: normalizeOptionalText(translation.shortDescription),
    shortDescriptionHtml: translation.shortDescriptionHtml,
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

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = productAdminInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const translations = getProductTranslations(input);
  const nlTranslation = translations.find((translation) => translation.locale === "nl");
  if (!nlTranslation) {
    return NextResponse.json({ error: "NL_TRANSLATION_REQUIRED" }, { status: 400 });
  }
  const requestedCategories = getProductCategories(input);
  const requestedCategoryIds = requestedCategories.map((category) => category.categoryId);

  try {
    for (const translation of translations) {
      if (await prisma.productSlugAlias.findUnique({
        where: { locale_slug: { locale: translation.locale, slug: translation.slug } },
        select: { id: true },
      })) {
        return NextResponse.json({
          error: "CONFLICT",
          message: `De ${translation.locale.toUpperCase()}-slug is gereserveerd als oude productlink.`,
        }, { status: 409 });
      }
    }

    const categories = await prisma.category.findMany({
      where: { id: { in: requestedCategoryIds } },
      select: {
        id: true,
        parentId: true,
        translations: { select: { locale: true, slug: true } },
      },
    });
    if (categories.length !== requestedCategoryIds.length) {
      return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });
    }
    for (const category of categories) {
      if (category.parentId && !requestedCategoryIds.includes(category.parentId)) {
        return NextResponse.json({ error: "CATEGORY_PARENT_REQUIRED" }, { status: 400 });
      }
    }
    if (await prisma.product.count({ where: { id: { in: input.recommendationIds } } }) !== input.recommendationIds.length) {
      return NextResponse.json({ error: "RECOMMENDATION_NOT_FOUND" }, { status: 400 });
    }

    const productId = await prisma.$transaction(async (tx) => {
      const categoryAssignments = input.categories && input.categoryPlacementMode === "manual"
        ? requestedCategories
        : await Promise.all(requestedCategories.map(async (category) => {
            const maximum = await tx.productCategory.aggregate({
              where: { categoryId: category.categoryId },
              _max: { sortOrder: true },
            });
            return { ...category, sortOrder: (maximum._max.sortOrder ?? -1) + 1 };
          }));

      const created = await tx.product.create({
        data: {
          sku: input.sku,
          slug: nlTranslation.slug,
          basePriceCents: input.basePriceCents,
          salePriceCents: input.salePriceCents,
          unit: input.unit,
          isActive: input.isActive,
          translations: { create: translations.map(translationData) },
          productCategories: categoryAssignments.length
            ? { create: categoryAssignments }
            : undefined,
          variants: input.variants.length
            ? {
                create: input.variants.map((variant) => ({
                  sku: variant.sku,
                  weightGrams: variant.weightGrams,
                  preparation: variant.preparation,
                  salting: variant.salting,
                  coating: variant.coating,
                  isActive: variant.isActive,
                  priceCents: variant.priceCents,
                  salePriceCents: variant.salePriceCents,
                  stock: variant.stock,
                  translations: {
                    create: {
                      locale: "nl",
                      label: variant.label ?? `${variant.weightGrams} ${input.unit === "VOLUME" ? "ml" : "g"}`,
                    },
                  },
                })),
              }
            : undefined,
        },
        select: { id: true },
      });

      await upsertNutrition(tx, created.id, input.nutrition);
      if (input.recommendationIds.length) {
        await tx.productRecommendation.createMany({
          data: input.recommendationIds.map((targetProductId, sortOrder) => ({
            sourceProductId: created.id,
            targetProductId,
            sortOrder,
          })),
        });
      }
      return created.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const created = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        updatedAt: true,
        translations: {
          select: {
            locale: true,
            slug: true,
            name: true,
            shortDescription: true,
            shortDescriptionHtml: true,
            description: true,
            descriptionHtml: true,
            seoTitle: true,
            metaDescription: true,
            promotionText: true,
          },
        },
        variants: { select: { id: true, sku: true }, orderBy: { sku: "asc" } },
        images: { select: { id: true, sortOrder: true, isPrimary: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    const revalidation = revalidateProductStorefront({
      productId,
      translations: translations.map(({ locale, slug }) => ({ locale, slug })),
      categoryTranslations: categories.flatMap((category) => category.translations),
    });
    if (input.isActive) {
      scheduleIndexNowUrls(buildProductIndexNowUrls({
        baseUrl: BASE_URL,
        translations: translations.map(({ locale, slug }) => ({ locale, slug })),
        categoryTranslations: categories.flatMap((category) => category.translations),
      }));
    }
    return NextResponse.json({
      ok: true,
      productId,
      version: created.updatedAt.toISOString(),
      variants: created.variants,
      images: created.images,
      translations: created.translations,
      frontendSynced: revalidation.frontendSynced,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "CONFLICT", message: "Deze slug of SKU is al in gebruik." }, { status: 409 });
    }
    console.error("Failed to create product", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
