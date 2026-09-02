import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";

const businessAccountPatchSchema = z
  .object({
    companyName: z.string().trim().min(1).optional(),
    contactName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().nullable().optional(),
    vatNumber: z.string().trim().nullable().optional(),
    kvkNumber: z.string().trim().nullable().optional(),
    country: z.enum(["NL", "BE"]).optional(),
    vatRegime: z.enum(["STANDARD", "REVERSE_CHARGE"]).optional(),
    vatRatePercent: z.coerce.number().min(0).max(100).optional(),
    peppolParticipantId: z.string().trim().nullable().optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .strict();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await context.params;

  const businessAccount = await prisma.businessAccount.findUnique({ where: { id } });

  if (!businessAccount) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ businessAccount });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id } = await context.params;

  const existing = await prisma.businessAccount.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = businessAccountPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const emailChanged = input.email !== undefined && input.email.toLowerCase() !== existing.email.toLowerCase();
  const data: {
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string | null;
    vatNumber?: string | null;
    kvkNumber?: string | null;
    country?: "NL" | "BE";
    vatRegime?: "STANDARD" | "REVERSE_CHARGE";
    vatRatePercent?: number;
    peppolParticipantId?: string | null;
    peppolConfigured?: boolean;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
    notes?: string | null;
  } = {};

  if (input.companyName !== undefined) data.companyName = input.companyName;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.phone !== undefined) data.phone = input.phone?.trim() ? input.phone.trim() : null;
  if (input.vatNumber !== undefined) data.vatNumber = input.vatNumber?.trim() ? input.vatNumber.trim() : null;
  if (input.kvkNumber !== undefined) data.kvkNumber = input.kvkNumber?.trim() ? input.kvkNumber.trim() : null;
  if (input.country !== undefined) data.country = input.country;
  if (input.vatRegime !== undefined) data.vatRegime = input.vatRegime;
  if (input.vatRatePercent !== undefined) data.vatRatePercent = input.vatRatePercent;
  if (input.peppolParticipantId !== undefined) {
    const trimmed = input.peppolParticipantId?.trim() || null;
    data.peppolParticipantId = trimmed;
    data.peppolConfigured = Boolean(trimmed);
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes?.trim() ? input.notes.trim() : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const businessAccount = await tx.businessAccount.update({ where: { id }, data });
      if ((data.status && data.status !== "APPROVED") || emailChanged) {
        const revokedAt = new Date();
        await tx.businessSession.updateMany({ where: { businessAccountId: id, revokedAt: null }, data: { revokedAt } });
        await tx.businessInvitation.updateMany({ where: { businessAccountId: id, acceptedAt: null, revokedAt: null }, data: { revokedAt } });
        if (emailChanged) {
          await tx.businessAccount.update({ where: { id }, data: { loginLinkRequestedAt: null } });
        }
      }
      await recordAudit(tx, admin, "BusinessAccount", id, "UPDATE", existing, businessAccount);
      await recordBusinessEvent(tx, {
        businessAccountId: id,
        type: "ACCOUNT_UPDATED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Zakelijk account voor ${businessAccount.companyName} bijgewerkt`,
        metadata: { fields: Object.keys(data) },
      });
      return businessAccount;
    });

    return NextResponse.json({ ok: true, businessAccount: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
