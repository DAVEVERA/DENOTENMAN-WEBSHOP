import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";
import { resolveVat } from "@/lib/business-vat";

const businessAccountInputSchema = z
  .object({
    companyName: z.string().trim().min(1, "companyName required"),
    contactName: z.string().trim().min(1, "contactName required"),
    email: z.string().trim().email("valid email required"),
    phone: z.string().trim().nullable().optional(),
    vatNumber: z.string().trim().nullable().optional(),
    kvkNumber: z.string().trim().nullable().optional(),
    country: z.enum(["NL", "BE"]).optional(),
    vatRegime: z.enum(["STANDARD", "REVERSE_CHARGE"]).optional(),
    vatRatePercent: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const businessAccounts = await prisma.businessAccount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ businessAccounts });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const parsed = businessAccountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const country = input.country ?? "NL";
  const vatDefaults = resolveVat(country);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const businessAccount = await tx.businessAccount.create({
        data: {
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email.toLowerCase(),
          phone: input.phone?.trim() ? input.phone.trim() : null,
          vatNumber: input.vatNumber?.trim() ? input.vatNumber.trim() : null,
          kvkNumber: input.kvkNumber?.trim() ? input.kvkNumber.trim() : null,
          country,
          vatRegime: input.vatRegime ?? vatDefaults.regime,
          vatRatePercent: input.vatRatePercent ?? vatDefaults.ratePercent,
          status: input.status ?? "PENDING",
          notes: input.notes?.trim() ? input.notes.trim() : null,
        },
      });

      await recordAudit(tx, admin, "BusinessAccount", businessAccount.id, "CREATE", null, businessAccount);
      await recordBusinessEvent(tx, {
        businessAccountId: businessAccount.id,
        type: "ACCOUNT_CREATED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Zakelijk account voor ${businessAccount.companyName} aangemaakt`,
      });

      return businessAccount;
    });

    return NextResponse.json({ ok: true, businessAccount: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
