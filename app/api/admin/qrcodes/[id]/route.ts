import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { qrCodeInputSchema } from "@/lib/qrcode-schema";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const design = await prisma.qrCodeDesign.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, design });
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

  const existing = await prisma.qrCodeDesign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parsed = qrCodeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const design = await tx.qrCodeDesign.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status ?? existing.status,
          targetType: input.targetType,
          targetConfig: input.targetConfig as Prisma.InputJsonValue,
          designConfig: input.designConfig as Prisma.InputJsonValue,
          labelConfig: input.labelConfig as Prisma.InputJsonValue,
        },
      });

      await recordAudit(tx, admin, "QrCodeDesign", id, "UPDATE", existing, design);

      return design;
    });

    return NextResponse.json({ ok: true, design: updated });
  } catch (error) {
    console.error("Failed to update QR code design", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
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

  const existing = await prisma.qrCodeDesign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.qrCodeDesign.delete({ where: { id } });
      await recordAudit(tx, admin, "QrCodeDesign", id, "DELETE", existing, null);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete QR code design", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
