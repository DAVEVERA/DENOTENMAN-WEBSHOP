import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const campaignInputSchema = z
  .object({
    title: z.string().trim().min(1, "title required"),
    description: z.string().trim().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ENDED"]),
    startsAt: z.string().trim().nullable().optional(),
    endsAt: z.string().trim().nullable().optional(),
  })
  .strict();

function parseDate(value: string | null | undefined): Date | null | { error: string } {
  if (value === undefined || value === null || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: "INVALID_DATE" };
  return date;
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const campaigns = await prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = campaignInputSchema.safeParse(await request.json().catch(() => null));
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
    const campaign = await tx.marketingCampaign.create({
      data: {
        title: input.title,
        description: input.description?.trim() ? input.description.trim() : null,
        status: input.status,
        startsAt: startsAt as Date | null,
        endsAt: endsAt as Date | null,
      },
    });

    await recordAudit(tx, admin, "MarketingCampaign", campaign.id, "CREATE", null, campaign);

    return campaign;
  });

  return NextResponse.json({ ok: true, campaign: created }, { status: 201 });
}
