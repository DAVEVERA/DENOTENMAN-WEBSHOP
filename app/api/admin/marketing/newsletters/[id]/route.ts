import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const newsletterPatchSchema = z
  .object({
    subject: z.string().trim().min(1).optional(),
    bodyHtml: z.string().trim().min(1).optional(),
    status: z.enum(["DRAFT", "SCHEDULED", "SENT"]).optional(),
    scheduledAt: z.string().trim().nullable().optional(),
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

  const existing = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = newsletterPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const data: {
    subject?: string;
    bodyHtml?: string;
    status?: "DRAFT" | "SCHEDULED" | "SENT";
    scheduledAt?: Date | null;
    sentAt?: Date | null;
  } = {};

  if (input.subject !== undefined) data.subject = input.subject;
  if (input.bodyHtml !== undefined) data.bodyHtml = input.bodyHtml;

  if (input.scheduledAt !== undefined) {
    const parsedScheduled = parseDate(input.scheduledAt);
    if (parsedScheduled && "error" in parsedScheduled) {
      return NextResponse.json({ error: "INVALID_SCHEDULED_AT" }, { status: 400 });
    }
    data.scheduledAt = parsedScheduled as Date | null;
  }

  if (input.status !== undefined) {
    const nextScheduledAt = data.scheduledAt !== undefined ? data.scheduledAt : existing.scheduledAt;
    if (input.status === "SCHEDULED" && !nextScheduledAt) {
      return NextResponse.json({ error: "SCHEDULED_AT_REQUIRED" }, { status: 400 });
    }
    data.status = input.status;
    if (input.status === "SENT" && !existing.sentAt) {
      data.sentAt = new Date();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const newsletter = await tx.newsletterCampaign.update({ where: { id }, data });
    await recordAudit(tx, admin, "NewsletterCampaign", id, "UPDATE", existing, newsletter);
    return newsletter;
  });

  return NextResponse.json({ ok: true, newsletter: updated });
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

  const existing = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.newsletterCampaign.delete({ where: { id } });
    await recordAudit(tx, admin, "NewsletterCampaign", id, "DELETE", existing, null);
  });

  return NextResponse.json({ ok: true });
}
