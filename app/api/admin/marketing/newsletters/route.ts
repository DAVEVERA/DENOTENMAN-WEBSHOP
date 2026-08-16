import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const newsletterInputSchema = z
  .object({
    subject: z.string().trim().min(1, "subject required"),
    bodyHtml: z.string().trim().min(1, "bodyHtml required"),
    status: z.enum(["DRAFT", "SCHEDULED", "SENT"]),
    scheduledAt: z.string().trim().nullable().optional(),
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

  const newsletters = await prisma.newsletterCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ newsletters });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = newsletterInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  const scheduledAt = parseDate(input.scheduledAt);
  if (scheduledAt && "error" in scheduledAt) {
    return NextResponse.json({ error: "INVALID_SCHEDULED_AT" }, { status: 400 });
  }
  if (input.status === "SCHEDULED" && !scheduledAt) {
    return NextResponse.json({ error: "SCHEDULED_AT_REQUIRED" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const newsletter = await tx.newsletterCampaign.create({
      data: {
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        status: input.status,
        scheduledAt: scheduledAt as Date | null,
        sentAt: input.status === "SENT" ? new Date() : null,
      },
    });

    await recordAudit(tx, admin, "NewsletterCampaign", newsletter.id, "CREATE", null, newsletter);

    return newsletter;
  });

  return NextResponse.json({ ok: true, newsletter: created }, { status: 201 });
}
