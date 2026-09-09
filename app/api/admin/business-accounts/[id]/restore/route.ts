import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";

export async function POST(
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
  if (!existing.deletedAt) {
    return NextResponse.json({ error: "NOT_DELETED" }, { status: 409 });
  }

  try {
    const restored = await prisma.$transaction(async (tx) => {
      const businessAccount = await tx.businessAccount.update({
        where: { id },
        data: { deletedAt: null },
      });
      await recordAudit(tx, admin, "BusinessAccount", id, "RESTORE", existing, businessAccount);
      await recordBusinessEvent(tx, {
        businessAccountId: id,
        type: "ACCOUNT_UPDATED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Zakelijk account voor ${businessAccount.companyName} hersteld`,
      });
      return businessAccount;
    });

    return NextResponse.json({ ok: true, businessAccount: restored });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
