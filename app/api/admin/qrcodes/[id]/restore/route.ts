import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.qrCodeDesign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status === "active") {
    return NextResponse.json({ ok: true, design: existing });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const design = await tx.qrCodeDesign.update({
      where: { id },
      data: { status: "active" },
    });
    await recordAudit(tx, admin, "QrCodeDesign", id, "RESTORE", existing, design);
    return design;
  });

  return NextResponse.json({ ok: true, design: updated });
}
