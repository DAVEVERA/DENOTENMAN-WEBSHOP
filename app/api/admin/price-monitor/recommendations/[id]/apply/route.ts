import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  hasProductWritePermission,
  isSameOriginMutation,
} from "@/lib/admin-request-security";
import { prisma } from "@/lib/prisma";
import { priceMonitorApplySchema } from "@/lib/price-monitor/inputs";
import {
  applyPriceMonitorRecommendation,
  PriceMonitorServiceError,
} from "@/lib/price-monitor/service";
import { revalidateProductStorefront } from "@/lib/product-revalidation";

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
  const parsed = priceMonitorApplySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const { id } = await context.params;
    const result = await applyPriceMonitorRecommendation({
      recommendationId: id,
      ...parsed.data,
      admin,
    });
    const product = await prisma.product.findUnique({
      where: { id: result.productId },
      select: {
        id: true,
        translations: { select: { locale: true, slug: true } },
        productCategories: {
          select: {
            category: { select: { translations: { select: { locale: true, slug: true } } } },
          },
        },
      },
    });
    const revalidation = product
      ? revalidateProductStorefront({
        productId: product.id,
        translations: product.translations,
        categoryTranslations: product.productCategories.flatMap(
          (assignment) => assignment.category.translations
        ),
      })
      : { frontendSynced: false, failedPaths: [] };
    revalidatePath("/admin/prijsmonitor");
    return NextResponse.json({
      ok: true,
      ...result,
      frontendSynced: revalidation.frontendSynced,
      syncWarning: revalidation.frontendSynced
        ? null
        : "PRICE_SAVED_STOREFRONT_REFRESH_FAILED",
    });
  } catch (error) {
    if (error instanceof PriceMonitorServiceError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("Price monitor recommendation apply failed", { adminUserId: admin.id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
