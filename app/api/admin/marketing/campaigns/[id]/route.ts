import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const campaignPatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ENDED"]).optional(),
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

  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = campaignPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const data: {
    title?: string;
    description?: string | null;
    status?: "DRAFT" | "ACTIVE" | "ENDED";
    startsAt?: Date | null;
    endsAt?: Date | null;
  } = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) {
    data.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.status !== undefined) data.status = input.status;

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
    const campaign = await tx.marketingCampaign.update({ where: { id }, data });
    await recordAudit(tx, admin, "MarketingCampaign", id, "UPDATE", existing, campaign);
    return campaign;
  });

  return NextResponse.json({ ok: true, campaign: updated });
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

  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketingCampaign.delete({ where: { id } });
    await recordAudit(tx, admin, "MarketingCampaign", id, "DELETE", existing, null);
  });

  return NextResponse.json({ ok: true });
}
