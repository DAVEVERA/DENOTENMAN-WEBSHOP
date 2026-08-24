import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";

const quotePatchSchema = z
  .object({
    status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED"]),
  })
  .strict();

// Only forward transitions are allowed: a quote moves through DRAFT -> SENT,
// then SENT resolves to either ACCEPTED or DECLINED. ACCEPTED/DECLINED are
// terminal — no further transitions out of them, and no skipping DRAFT -> ACCEPTED.
const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "DECLINED"],
  ACCEPTED: [],
  DECLINED: [],
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; quoteId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id, quoteId } = await context.params;

  const existing = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!existing || existing.businessAccountId !== id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = quotePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const nextStatus = parsed.data.status;

  if (nextStatus === existing.status) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: "INVALID_STATUS_TRANSITION", from: existing.status, to: nextStatus },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.update({
      where: { id: quoteId },
      data: { status: nextStatus },
    });
    await recordAudit(tx, admin, "Quote", quoteId, "UPDATE", existing, quote);
    return quote;
  });

  return NextResponse.json({ ok: true, quote: updated });
}
