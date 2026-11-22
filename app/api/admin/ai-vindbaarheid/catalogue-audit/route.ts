import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { auditLocales } from "@/lib/product-audit-core";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { runBatchAudit } from "@/lib/ai-vindbaarheid/batch-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 6;

/** Admin-triggered, read-only catalogue scan. Each request is deliberately bounded. */
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "ORIGIN_MISMATCH" }, { status: 403 });
  }
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const { cursor } = payload as { cursor?: unknown };
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 128 || !cursor)) {
    return NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
  }

  const where = { isActive: true, translations: { some: { locale: "nl" } } };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        translations: { select: { locale: true, slug: true, name: true } },
      },
      orderBy: { id: "asc" },
      ...(typeof cursor === "string" ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
    }),
  ]);
  const results = await runBatchAudit(products.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.translations.find((translation) => translation.locale === "nl")?.name ?? item.sku,
    targets: item.translations
      .filter((t) => auditLocales.some((locale) => locale === t.locale) && t.slug.trim() && t.name.trim())
      .map((t) => ({
        locale: t.locale as (typeof auditLocales)[number],
        path: productPath(t.locale as (typeof auditLocales)[number], t.slug),
        productName: t.name,
      })),
  })), { baseUrl: BASE_URL, concurrency: 2 });

  return NextResponse.json({
    results,
    total,
    nextCursor: products.length === BATCH_SIZE ? products[products.length - 1].id : null,
    scannedAt: new Date().toISOString(),
    // 'done' is determined by an empty following batch or the final short batch.
    done: products.length < BATCH_SIZE,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
