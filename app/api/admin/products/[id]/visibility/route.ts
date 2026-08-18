import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  productVisibilityInputSchema,
} from "@/lib/product-visibility";
import { revalidateProductStorefront } from "@/lib/product-revalidation";
import { notifyPendingStockSubscribers } from "@/lib/stock-notifications";
import {
  buildProductIndexNowUrls,
  scheduleIndexNowUrls,
} from "@/lib/indexnow";
import { BASE_URL } from "@/lib/routes";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = productVisibilityInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.product.findUnique({
        where: { id },
        select: {
          id: true,
          isActive: true,
          updatedAt: true,
          translations: { select: { locale: true, slug: true } },
          productCategories: {
            select: {
              category: { select: { translations: { select: { locale: true, slug: true } } } },
            },
          },
        },
      });
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (current.updatedAt.toISOString() !== input.version) throw new Error("STALE_PRODUCT");

      if (current.isActive === input.isActive) {
        return { current, updated: current, changed: false };
      }

      const updated = await transaction.product.update({
        where: { id },
        data: { isActive: input.isActive },
        select: { id: true, isActive: true, updatedAt: true },
      });
      await recordAudit(
        transaction,
        admin,
        "Product",
        id,
        "UPDATE",
        { isActive: current.isActive, updatedAt: current.updatedAt.toISOString() },
        { isActive: updated.isActive, updatedAt: updated.updatedAt.toISOString() }
      );

      return { current, updated, changed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const revalidation = revalidateProductStorefront({
      productId: id,
      translations: result.current.translations,
      categoryTranslations: result.current.productCategories.flatMap(
        (assignment) => assignment.category.translations
      ),
    });

    if (result.changed) {
      scheduleIndexNowUrls(buildProductIndexNowUrls({
        baseUrl: BASE_URL,
        translations: result.current.translations,
        categoryTranslations: result.current.productCategories.flatMap(
          (assignment) => assignment.category.translations
        ),
      }));
    }

    if (result.changed) {
      console.info("Product visibility updated", {
        productId: id,
        isActive: result.updated.isActive,
        adminUserId: admin.id,
      });
    }

    if (!result.current.isActive && result.updated.isActive) {
      await notifyPendingStockSubscribers(id).catch((error) =>
        console.error(`Stock notification run failed for ${id}`, error)
      );
    }

    return NextResponse.json({
      ok: true,
      isActive: result.updated.isActive,
      version: result.updated.updatedAt.toISOString(),
      frontendSynced: revalidation.frontendSynced,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_PRODUCT") {
      return NextResponse.json({ error: "STALE_PRODUCT" }, { status: 409 });
    }
    console.error("Failed to update product visibility", { productId: id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
