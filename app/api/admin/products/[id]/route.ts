import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { productAdminInputSchema, normalizeOptionalText } from "@/lib/admin-product-schema";
import { notifyPendingStockSubscribers } from "@/lib/stock-notifications";
import { prisma } from "@/lib/prisma";

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "CONFLICT", message: "Deze slug of SKU is al in gebruik." }, { status: 409 });
  }
  console.error("Failed to update product", error);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
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
  let shouldNotify = false;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id },
        include: { variants: { select: { id: true } }, translations: { where: { locale: "nl" } } },
      });
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (input.version && current.updatedAt.toISOString() !== input.version) throw new Error("STALE_PRODUCT");

      const categories = await tx.category.findMany({
        where: { id: { in: input.categoryIds } },
        select: { id: true, parentId: true },
      });
      if (categories.length !== input.categoryIds.length) throw new Error("CATEGORY_NOT_FOUND");
      for (const category of categories) {
        if (category.parentId && !input.categoryIds.includes(category.parentId)) throw new Error("CATEGORY_PARENT_REQUIRED");
      }
      if (await tx.product.count({ where: { id: { in: input.recommendationIds } } }) !== input.recommendationIds.length) {
        throw new Error("RECOMMENDATION_NOT_FOUND");
      }

      const knownVariantIds = new Set(current.variants.map((variant) => variant.id));
      for (const variant of input.variants) {
        if (variant.id && !knownVariantIds.has(variant.id)) throw new Error("VARIANT_NOT_FOUND");
      }

      const claimedAlias = await tx.productSlugAlias.findUnique({
        where: { locale_slug: { locale: "nl", slug: input.slug } },
      });
      if (claimedAlias && claimedAlias.productId !== id) throw new Error("SLUG_ALIAS_CONFLICT");
      if (claimedAlias?.productId === id) await tx.productSlugAlias.delete({ where: { id: claimedAlias.id } });

      const nlTranslation = current.translations[0];
      if (nlTranslation && nlTranslation.slug !== input.slug) {
        const existingAlias = await tx.productSlugAlias.findUnique({
          where: { locale_slug: { locale: "nl", slug: nlTranslation.slug } },
        });
        if (existingAlias && existingAlias.productId !== id) throw new Error("SLUG_ALIAS_CONFLICT");
        if (!existingAlias) await tx.productSlugAlias.create({ data: { productId: id, locale: "nl", slug: nlTranslation.slug } });
      }

      await tx.product.update({
        where: { id },
        data: {
          sku: input.sku,
          slug: input.slug,
          basePriceCents: input.basePriceCents,
          salePriceCents: input.salePriceCents,
          unit: input.unit,
          isActive: input.isActive,
        },
      });
      await tx.productTranslation.upsert({
        where: { productId_locale: { productId: id, locale: "nl" } },
        update: {
          name: input.translation.name,
          slug: input.slug,
          shortDescription: normalizeOptionalText(input.translation.shortDescription),
          description: input.translation.description?.trim() || null,
        },
        create: {
          productId: id,
          locale: "nl",
          name: input.translation.name,
          slug: input.slug,
          shortDescription: normalizeOptionalText(input.translation.shortDescription),
          description: input.translation.description?.trim() || null,
        },
      });

      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (input.categoryIds.length) {
        await tx.productCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ productId: id, categoryId })) });
      }
      await tx.productRecommendation.deleteMany({ where: { sourceProductId: id } });
      if (input.recommendationIds.length) {
        await tx.productRecommendation.createMany({
          data: input.recommendationIds.map((targetProductId, sortOrder) => ({ sourceProductId: id, targetProductId, sortOrder })),
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
    await notifyPendingStockSubscribers(id).catch((error) => console.error(`Stock notification run failed for ${id}`, error));
  }
  const updated = await prisma.product.findUnique({
    where: { id },
    select: { updatedAt: true, variants: { select: { id: true, sku: true } } },
  });
  return NextResponse.json({ ok: true, version: updated?.updatedAt.toISOString(), variants: updated?.variants ?? [] });
}
