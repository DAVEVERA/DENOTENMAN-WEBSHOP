import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { searchProductSources } from "@/lib/ai-vindbaarheid/brave-source-search";
import type { ProductResearchTarget } from "@/lib/ai-vindbaarheid/source-research";

export const runtime = "nodejs";

const FIELDS = new Set<ProductResearchTarget["field"]>(["ingredients", "allergens", "mayContainTraces", "nutrition"]);

/**
 * Explicit admin-triggered, read-only external research. No arbitrary URLs,
 * user-provided queries, automatic publishing or catalog-wide requests.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ error: "ORIGIN_MISMATCH" }, { status: 403 });
  }

  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const payload = input as Record<string, unknown>;
  const productId = payload.productId;
  const variantId = payload.variantId;
  const field = payload.field;
  if (
    typeof productId !== "string" || !productId || productId.length > 128 ||
    typeof variantId !== "string" || !variantId || variantId.length > 128 ||
    typeof field !== "string" || !FIELDS.has(field as ProductResearchTarget["field"])
  ) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, product: { isActive: true } },
    select: {
      id: true, sku: true, weightGrams: true, productId: true,
      product: {
        select: {
          translations: {
            where: { locale: "nl" }, take: 1,
            select: { name: true },
          },
        },
      },
    },
  });
  if (!variant) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  const productName = variant.product.translations[0]?.name;
  if (!productName) return NextResponse.json({ error: "PRODUCT_NAME_MISSING" }, { status: 422 });

  const result = await searchProductSources({
    productId: variant.productId,
    variantId: variant.id,
    sku: variant.sku,
    productName,
    weightGrams: variant.weightGrams,
    field: field as ProductResearchTarget["field"],
  });

  return NextResponse.json(result, {
    status: result.status === "not_configured" ? 503 : 200,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
