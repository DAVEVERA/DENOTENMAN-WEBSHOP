import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { revalidatePath } from "next/cache";

const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

const discountPatchSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    subtitle: z.string().trim().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "SCHEDULED", "EXPIRED"]).optional(),
    percentOff: z.number().int().nullable().optional(),
    amountOffCents: z.number().int().nullable().optional(),
    minimumOrderCents: z.number().int().min(0).max(100_000_000).optional(),
    maximumDiscountCents: z.number().int().min(1).max(100_000_000).nullable().optional(),
    redemptionMode: z.enum(["SINGLE_USE", "MULTIPLE_USE"]).optional(),
    identityScope: z.enum(["EMAIL", "CUSTOMER", "EMAIL_AND_CUSTOMER"]).optional(),
    maxUsesPerIdentity: z.number().int().min(1).max(100_000).nullable().optional(),
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = discountPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const data: {
    code?: string;
    title?: string;
    subtitle?: string | null;
    status?: "DRAFT" | "ACTIVE" | "SCHEDULED" | "EXPIRED";
    percentOff?: number | null;
    amountOffCents?: number | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    minimumOrderCents?: number;
    maximumDiscountCents?: number | null;
    redemptionMode?: "SINGLE_USE" | "MULTIPLE_USE";
    identityScope?: "EMAIL" | "CUSTOMER" | "EMAIL_AND_CUSTOMER";
    maxUsesPerIdentity?: number | null;
  } = {};

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return NextResponse.json({ error: "INVALID_CODE_FORMAT" }, { status: 400 });
    }
    if (code !== existing.code) {
      return NextResponse.json({ error: "CODE_IMMUTABLE" }, { status: 409 });
    }
    data.code = code;
  }

  if (input.title !== undefined) data.title = input.title;
  if (input.subtitle !== undefined) data.subtitle = input.subtitle?.trim() ? input.subtitle.trim() : null;
  if (input.status !== undefined) data.status = input.status;
  if (input.minimumOrderCents !== undefined) data.minimumOrderCents = input.minimumOrderCents;
  if (input.maximumDiscountCents !== undefined) data.maximumDiscountCents = input.maximumDiscountCents;
  if (input.redemptionMode !== undefined) data.redemptionMode = input.redemptionMode;
  if (input.identityScope !== undefined) data.identityScope = input.identityScope;
  if (input.maxUsesPerIdentity !== undefined) data.maxUsesPerIdentity = input.maxUsesPerIdentity;

  const nextRedemptionMode = input.redemptionMode ?? existing.redemptionMode;
  const nextMaxUses = input.maxUsesPerIdentity !== undefined ? input.maxUsesPerIdentity : existing.maxUsesPerIdentity;
  if (nextRedemptionMode === "SINGLE_USE") {
    data.maxUsesPerIdentity = 1;
  } else if (nextMaxUses !== null && nextMaxUses < 1) {
    return NextResponse.json({ error: "INVALID_MAX_USES" }, { status: 400 });
  }

  const percentOffProvided = input.percentOff !== undefined;
  const amountOffCentsProvided = input.amountOffCents !== undefined;
  if (percentOffProvided) data.percentOff = input.percentOff;
  if (amountOffCentsProvided) data.amountOffCents = input.amountOffCents;

  if (percentOffProvided || amountOffCentsProvided) {
    const nextPercentOff = percentOffProvided ? input.percentOff : existing.percentOff;
    const nextAmountOffCents = amountOffCentsProvided ? input.amountOffCents : existing.amountOffCents;
    const hasPercentOff = nextPercentOff !== null && nextPercentOff !== undefined;
    const hasAmountOffCents = nextAmountOffCents !== null && nextAmountOffCents !== undefined;
    if (hasPercentOff === hasAmountOffCents) {
      return NextResponse.json({ error: "EXACTLY_ONE_DISCOUNT_TYPE_REQUIRED" }, { status: 400 });
    }
    if (hasPercentOff && (nextPercentOff! < 1 || nextPercentOff! > 100)) {
      return NextResponse.json({ error: "INVALID_PERCENT_OFF" }, { status: 400 });
    }
    if (hasAmountOffCents && nextAmountOffCents! < 1) {
      return NextResponse.json({ error: "INVALID_AMOUNT_OFF_CENTS" }, { status: 400 });
    }
    // Ensure the non-selected field is explicitly cleared.
    if (hasPercentOff) data.amountOffCents = null;
    if (hasAmountOffCents) {
      data.percentOff = null;
      data.maximumDiscountCents = null;
    }
  }

  if (input.startsAt !== undefined) {
    const parsedStart = parseDate(input.startsAt);
    if (parsedStart && "error" in parsedStart) {
      return NextResponse.json({ error: "INVALID_STARTS_AT" }, { status: 400 });
    }
    data.startsAt = parsedStart as Date | null;
  }
  if (input.endsAt !== undefined) {
    const parsedEnd = parseDate(input.endsAt);
    if (parsedEnd && "error" in parsedEnd) {
      return NextResponse.json({ error: "INVALID_ENDS_AT" }, { status: 400 });
    }
    data.endsAt = parsedEnd as Date | null;
  }

  const nextStartsAt = data.startsAt !== undefined ? data.startsAt : existing.startsAt;
  const nextEndsAt = data.endsAt !== undefined ? data.endsAt : existing.endsAt;
  if (nextStartsAt && nextEndsAt && nextStartsAt.getTime() > nextEndsAt.getTime()) {
    return NextResponse.json({ error: "END_BEFORE_START" }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const discount = await tx.discount.update({ where: { id }, data });
      await recordAudit(tx, admin, "Discount", id, "UPDATE", existing, discount);
      return discount;
    });

    revalidatePath("/admin/kortingen");

    return NextResponse.json({ ok: true, discount: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "CODE_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.discount.delete({ where: { id } });
    await recordAudit(tx, admin, "Discount", id, "DELETE", existing, null);
  });

  revalidatePath("/admin/kortingen");

  return NextResponse.json({ ok: true });
}
