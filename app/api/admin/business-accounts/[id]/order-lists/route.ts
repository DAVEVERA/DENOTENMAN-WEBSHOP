import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";
import { recordAudit } from "@/lib/admin-audit";
import { calculateBusinessOrderListTotal } from "@/lib/business-portal-contract";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  validUntil: z.string().datetime().nullable().optional(),
  items: z.array(z.object({
    variantId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(100_000),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
  })).min(1).max(200),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
  if (validUntil && validUntil.getTime() <= Date.now()) {
    return NextResponse.json({ error: "VALID_UNTIL_IN_PAST" }, { status: 400 });
  }
  const account = await prisma.businessAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (account.status !== "APPROVED") return NextResponse.json({ error: "ACCOUNT_NOT_APPROVED" }, { status: 409 });

  const variantIds = parsed.data.items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    return NextResponse.json({ error: "DUPLICATE_VARIANT" }, { status: 400 });
  }
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true, product: { isActive: true } },
    include: {
      product: { select: { translations: { where: { locale: "nl" }, select: { name: true } } } },
      translations: { where: { locale: "nl" }, select: { label: true } },
    },
  });
  if (variants.length !== variantIds.length) return NextResponse.json({ error: "VARIANT_NOT_AVAILABLE" }, { status: 409 });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  let totalCents: number;
  try {
    totalCents = calculateBusinessOrderListTotal(parsed.data.items);
  } catch {
    return NextResponse.json({ error: "TOTAL_OUT_OF_RANGE" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const orderList = await tx.businessOrderList.create({
      data: {
        businessAccountId: id,
        title: parsed.data.title,
        totalCents,
        validUntil,
        createdByAdminId: admin.id,
        items: {
          create: parsed.data.items.map((item, index) => {
            const variant = variantById.get(item.variantId)!;
            return {
              productVariantId: variant.id,
              productName: variant.product.translations[0]?.name ?? variant.sku,
              variantLabel: variant.translations[0]?.label ?? `${variant.weightGrams} gram`,
              sku: variant.sku,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              sortOrder: index,
            };
          }),
        },
      },
      include: { items: true },
    });
    await recordBusinessEvent(tx, {
      businessAccountId: id,
      orderListId: orderList.id,
      type: "ORDER_LIST_CREATED",
      actorType: "ADMIN",
      actorName: admin.name,
      summary: `Bestellijst “${orderList.title}” aangemaakt`,
    });
    await recordAudit(tx, admin, "BusinessOrderList", orderList.id, "CREATE", null, orderList);
    return orderList;
  });

  return NextResponse.json({ ok: true, orderList: created }, { status: 201 });
}
