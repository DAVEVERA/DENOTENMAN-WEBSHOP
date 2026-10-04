import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
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
import {
  PublicationBlockedError,
  publicationBlockedContract,
  requirePublicationReadiness,
} from "@/lib/product-publication-readiness";
import {
  createProductVisibilityUndoToken,
  verifyProductVisibilityUndoToken,
} from "@/lib/product-visibility-undo";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasProductWritePermission(admin.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

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
          translations: { select: { locale: true, slug: true, name: true } },
          variants: {
            select: { isActive: true, priceCents: true, salePriceCents: true },
          },
          images: { select: { isPrimary: true } },
          productCategories: {
            select: {
              category: {
                select: {
                  isActive: true,
                  translations: { select: { locale: true, slug: true } },
                },
              },
            },
          },
        },
      });
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (current.updatedAt.toISOString() !== input.version) throw new Error("STALE_PRODUCT");

      const validUndo = await verifyProductVisibilityUndoToken(input.undoToken, {
        productId: id,
        adminUserId: admin.id,
        currentIsActive: current.isActive,
        targetIsActive: input.isActive,
        version: input.version,
      });
      if (input.undoToken && !validUndo) throw new Error("INVALID_UNDO_TOKEN");

      if (!current.isActive && input.isActive && !validUndo) {
        const nlTranslation = current.translations.find(
          (translation) => translation.locale === "nl"
        );
        requirePublicationReadiness({
          nlName: nlTranslation?.name,
          nlSlug: nlTranslation?.slug,
          variants: current.variants,
          activeCategoryCount: current.productCategories.filter(
            (assignment) => assignment.category.isActive
          ).length,
          hasPrimaryImage: current.images.some((image) => image.isPrimary),
        });
      }

      if (current.isActive === input.isActive) {
        return { current, updated: current, changed: false, wasUndo: false };
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

      return { current, updated, changed: true, wasUndo: validUndo };
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

    const undoToken = result.changed && !result.wasUndo
      ? await createProductVisibilityUndoToken({
          productId: id,
          adminUserId: admin.id,
          currentIsActive: result.updated.isActive,
          targetIsActive: result.current.isActive,
          version: result.updated.updatedAt.toISOString(),
        })
      : null;

    return NextResponse.json({
      ok: true,
      isActive: result.updated.isActive,
      version: result.updated.updatedAt.toISOString(),
      undoToken,
      frontendSynced: revalidation.frontendSynced,
    });
  } catch (error) {
    if (error instanceof PublicationBlockedError) {
      const contract = publicationBlockedContract(error.issues);
      return NextResponse.json(contract.body, { status: contract.status });
    }
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_PRODUCT") {
      return NextResponse.json({ error: "STALE_PRODUCT" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INVALID_UNDO_TOKEN") {
      return NextResponse.json({ error: "INVALID_UNDO_TOKEN" }, { status: 409 });
    }
    console.error("Failed to update product visibility", { productId: id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
