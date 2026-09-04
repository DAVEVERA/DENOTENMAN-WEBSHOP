import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { revalidatePath } from "next/cache";

// Discount codes: uppercase letters, digits, and hyphens only, 3-32 chars.
const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

const discountInputSchema = z
  .object({
    code: z.string().trim().min(1, "code required"),
    title: z.string().trim().min(1, "title required"),
    subtitle: z.string().trim().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "SCHEDULED", "EXPIRED"]),
    percentOff: z.number().int().nullable().optional(),
    amountOffCents: z.number().int().nullable().optional(),
    minimumOrderCents: z.number().int().min(0).max(100_000_000),
    maximumDiscountCents: z.number().int().min(1).max(100_000_000).nullable(),
    redemptionMode: z.enum(["SINGLE_USE", "MULTIPLE_USE"]),
    identityScope: z.enum(["EMAIL", "CUSTOMER", "EMAIL_AND_CUSTOMER"]),
    maxUsesPerIdentity: z.number().int().min(1).max(100_000).nullable(),
    startsAt: z.string().trim().nullable().optional(),
    endsAt: z.string().trim().nullable().optional(),
  })
  .strict();

function parseDate(value: string | null | undefined): Date | null | { error: true } {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: true };
  return date;
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ discounts });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = discountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const code = input.code.trim().toUpperCase();

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "INVALID_CODE_FORMAT" }, { status: 400 });
  }

  const hasPercentOff = input.percentOff !== undefined && input.percentOff !== null;
  const hasAmountOffCents = input.amountOffCents !== undefined && input.amountOffCents !== null;
  if (hasPercentOff === hasAmountOffCents) {
    // Both set or both unset — exactly one discount mechanism is required.
    return NextResponse.json({ error: "EXACTLY_ONE_DISCOUNT_TYPE_REQUIRED" }, { status: 400 });
  }
  if (hasPercentOff && (input.percentOff! < 1 || input.percentOff! > 100)) {
    return NextResponse.json({ error: "INVALID_PERCENT_OFF" }, { status: 400 });
  }
  if (hasAmountOffCents && input.amountOffCents! < 1) {
    return NextResponse.json({ error: "INVALID_AMOUNT_OFF_CENTS" }, { status: 400 });
  }
  if (input.redemptionMode === "SINGLE_USE" && input.maxUsesPerIdentity !== 1) {
    return NextResponse.json({ error: "SINGLE_USE_REQUIRES_ONE_USE" }, { status: 400 });
  }

  const startsAt = parseDate(input.startsAt);
  if (startsAt && "error" in startsAt) {
    return NextResponse.json({ error: "INVALID_STARTS_AT" }, { status: 400 });
  }
  const endsAt = parseDate(input.endsAt);
  if (endsAt && "error" in endsAt) {
    return NextResponse.json({ error: "INVALID_ENDS_AT" }, { status: 400 });
  }
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    return NextResponse.json({ error: "END_BEFORE_START" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          code,
          title: input.title,
          subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
          status: input.status,
          percentOff: hasPercentOff ? input.percentOff! : null,
          amountOffCents: hasAmountOffCents ? input.amountOffCents! : null,
          minimumOrderCents: input.minimumOrderCents,
          maximumDiscountCents: hasPercentOff ? input.maximumDiscountCents : null,
          redemptionMode: input.redemptionMode,
          identityScope: input.identityScope,
          maxUsesPerIdentity: input.redemptionMode === "SINGLE_USE" ? 1 : input.maxUsesPerIdentity,
          startsAt: startsAt as Date | null,
          endsAt: endsAt as Date | null,
        },
      });

      await recordAudit(tx, admin, "Discount", discount.id, "CREATE", null, discount);

      return discount;
    });

    revalidatePath("/admin/kortingen");

    return NextResponse.json({ ok: true, discount: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "CODE_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
