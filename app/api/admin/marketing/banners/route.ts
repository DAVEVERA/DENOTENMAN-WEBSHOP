import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const bannerInputSchema = z
  .object({
    title: z.string().trim().min(1, "title required"),
    imageUrl: z.string().trim().min(1, "imageUrl required"),
    linkUrl: z.string().trim().nullable().optional(),
    placement: z.enum(["HOMEPAGE", "CATEGORY", "PROMOTION"]),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
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

  const banners = await prisma.marketingBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ banners });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = bannerInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

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

  const created = await prisma.$transaction(async (tx) => {
    const banner = await tx.marketingBanner.create({
      data: {
        title: input.title,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl?.trim() ? input.linkUrl.trim() : null,
        placement: input.placement,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        startsAt: startsAt as Date | null,
        endsAt: endsAt as Date | null,
      },
    });

    await recordAudit(tx, admin, "MarketingBanner", banner.id, "CREATE", null, banner);

    return banner;
  });

  return NextResponse.json({ ok: true, banner: created }, { status: 201 });
}
