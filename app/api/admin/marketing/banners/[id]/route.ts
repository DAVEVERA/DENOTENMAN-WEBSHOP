import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const bannerPatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().min(1).optional(),
    linkUrl: z.string().trim().nullable().optional(),
    placement: z.enum(["HOMEPAGE", "CATEGORY", "PROMOTION"]).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
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

  const existing = await prisma.marketingBanner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = bannerPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const data: {
    title?: string;
    imageUrl?: string;
    linkUrl?: string | null;
    placement?: "HOMEPAGE" | "CATEGORY" | "PROMOTION";
    isActive?: boolean;
    sortOrder?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
  } = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl?.trim() ? input.linkUrl.trim() : null;
  if (input.placement !== undefined) data.placement = input.placement;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

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

  const updated = await prisma.$transaction(async (tx) => {
    const banner = await tx.marketingBanner.update({ where: { id }, data });
    await recordAudit(tx, admin, "MarketingBanner", id, "UPDATE", existing, banner);
    return banner;
  });

  return NextResponse.json({ ok: true, banner: updated });
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

  const existing = await prisma.marketingBanner.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketingBanner.delete({ where: { id } });
    await recordAudit(tx, admin, "MarketingBanner", id, "DELETE", existing, null);
  });

  return NextResponse.json({ ok: true });
}
