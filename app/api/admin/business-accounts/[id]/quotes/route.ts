import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const quoteItemSchema = z.object({
  productName: z.string().trim().min(1, "productName required").max(200),
  quantity: z.number().int().min(1, "quantity must be at least 1").max(100_000),
  unitPriceCents: z.number().int().min(0, "unitPriceCents must be positive").max(100_000_000),
});

const quoteInputSchema = z
  .object({
    items: z.array(quoteItemSchema).min(1, "at least one item required").max(200),
    validUntil: z.string().trim().nullable().optional(),
    status: z.enum(["DRAFT", "SENT"]).optional(),
  })
  .strict();

function parseDate(value: string | null | undefined): Date | null | { error: true } {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: true };
  return date;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;

  const businessAccount = await prisma.businessAccount.findUnique({ where: { id } });
  if (!businessAccount) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = quoteInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  const validUntil = parseDate(input.validUntil);
  if (validUntil && "error" in validUntil) {
    return NextResponse.json({ error: "INVALID_VALID_UNTIL" }, { status: 400 });
  }

  const totalCents = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );

  const created = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        businessAccountId: id,
        status: input.status ?? "DRAFT",
        items: input.items,
        totalCents,
        validUntil: validUntil as Date | null,
      },
    });

    await recordAudit(tx, admin, "Quote", quote.id, "CREATE", null, quote);

    return quote;
  });

  return NextResponse.json({ ok: true, quote: created }, { status: 201 });
}
