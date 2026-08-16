import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

const businessAccountPatchSchema = z
  .object({
    companyName: z.string().trim().min(1).optional(),
    contactName: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().nullable().optional(),
    vatNumber: z.string().trim().nullable().optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
    priceTier: z.string().trim().min(1).optional(),
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

  const businessAccount = await prisma.businessAccount.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "desc" } } },
  });

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
  const data: {
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string | null;
    vatNumber?: string | null;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
    priceTier?: string;
    notes?: string | null;
  } = {};

  if (input.companyName !== undefined) data.companyName = input.companyName;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.phone !== undefined) data.phone = input.phone?.trim() ? input.phone.trim() : null;
  if (input.vatNumber !== undefined) data.vatNumber = input.vatNumber?.trim() ? input.vatNumber.trim() : null;
  if (input.status !== undefined) data.status = input.status;
  if (input.priceTier !== undefined) data.priceTier = input.priceTier;
  if (input.notes !== undefined) data.notes = input.notes?.trim() ? input.notes.trim() : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const businessAccount = await tx.businessAccount.update({ where: { id }, data });
      await recordAudit(tx, admin, "BusinessAccount", id, "UPDATE", existing, businessAccount);
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
