import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { getBusinessPortalSession, recordBusinessEvent } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  vatNumber: z.string().trim().max(30).nullable().optional(),
  peppolParticipantId: z.string().trim().max(60).nullable().optional(),
}).strict();

/**
 * Self-service account details the business customer manages themselves —
 * Fedor can still see and correct these from the admin side, but the
 * customer is the one who actually knows their own VAT number and (for a
 * Belgian account) their Peppol participant ID.
 */
export async function PATCH(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const data: { vatNumber?: string | null; peppolParticipantId?: string | null; peppolConfigured?: boolean } = {};
  if (parsed.data.vatNumber !== undefined) {
    data.vatNumber = parsed.data.vatNumber?.trim() ? parsed.data.vatNumber.trim() : null;
  }
  if (parsed.data.peppolParticipantId !== undefined) {
    if (session.businessAccount.country !== "BE") {
      return NextResponse.json({ error: "PEPPOL_NOT_APPLICABLE" }, { status: 409 });
    }
    const trimmed = parsed.data.peppolParticipantId?.trim() || null;
    data.peppolParticipantId = trimmed;
    data.peppolConfigured = Boolean(trimmed);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const account = await tx.businessAccount.update({ where: { id: session.businessAccountId }, data });
    await recordBusinessEvent(tx, {
      businessAccountId: session.businessAccountId,
      type: "ACCOUNT_UPDATED",
      actorType: "CUSTOMER",
      actorName: account.contactName,
      summary: `${account.contactName} heeft de bedrijfsgegevens bijgewerkt`,
      metadata: { fields: Object.keys(data) },
    });
    return account;
  });

  return NextResponse.json({
    ok: true,
    vatNumber: updated.vatNumber,
    peppolParticipantId: updated.peppolParticipantId,
    peppolConfigured: updated.peppolConfigured,
  });
}
