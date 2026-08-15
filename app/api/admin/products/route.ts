import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { productAdminInputSchema, normalizeOptionalText } from "@/lib/admin-product-schema";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = productAdminInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  try {
    if (await prisma.productSlugAlias.findUnique({ where: { locale_slug: { locale: "nl", slug: input.slug } }, select: { id: true } })) {
      return NextResponse.json({ error: "CONFLICT", message: "Deze slug is gereserveerd als oude productlink." }, { status: 409 });
    }
    const categories = await prisma.category.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true, parentId: true } });
    if (categories.length !== input.categoryIds.length) return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 400 });
    for (const category of categories) {
      if (category.parentId && !input.categoryIds.includes(category.parentId)) return NextResponse.json({ error: "CATEGORY_PARENT_REQUIRED" }, { status: 400 });
    }
    if (await prisma.product.count({ where: { id: { in: input.recommendationIds } } }) !== input.recommendationIds.length) {
      return NextResponse.json({ error: "RECOMMENDATION_NOT_FOUND" }, { status: 400 });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
      data: {
        sku: input.sku,
        slug: input.slug,
        basePriceCents: input.basePriceCents,
        salePriceCents: input.salePriceCents,
        unit: input.unit,
        isActive: input.isActive,
        translations: { create: { locale: "nl", name: input.translation.name, slug: input.slug, shortDescription: normalizeOptionalText(input.translation.shortDescription), description: input.translation.description?.trim() || null } },
        productCategories: input.categoryIds.length ? { create: input.categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
        variants: input.variants.length ? { create: input.variants.map((variant) => ({
          sku: variant.sku,
          weightGrams: variant.weightGrams,
          preparation: variant.preparation,
          salting: variant.salting,
          coating: variant.coating,
          isActive: variant.isActive,
          priceCents: variant.priceCents,
          salePriceCents: variant.salePriceCents,
          stock: variant.stock,
          translations: { create: { locale: "nl", label: variant.label ?? `${variant.weightGrams} ${input.unit === "VOLUME" ? "ml" : "g"}` } },
        })) } : undefined,
      },
      select: { id: true },
      });
      if (input.recommendationIds.length) {
        await tx.productRecommendation.createMany({
          data: input.recommendationIds.map((targetProductId, sortOrder) => ({ sourceProductId: created.id, targetProductId, sortOrder })),
        });
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true, productId: product.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "CONFLICT", message: "Deze slug of SKU is al in gebruik." }, { status: 409 });
    }
    console.error("Failed to create product", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
