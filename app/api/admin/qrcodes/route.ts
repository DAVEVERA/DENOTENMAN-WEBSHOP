import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { qrCodeInputSchema } from "@/lib/qrcode-schema";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const designs = await prisma.qrCodeDesign.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ ok: true, designs });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = qrCodeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const design = await tx.qrCodeDesign.create({
        data: {
          name: input.name,
          status: input.status ?? "active",
          targetType: input.targetType,
          targetConfig: input.targetConfig as Prisma.InputJsonValue,
          designConfig: input.designConfig as Prisma.InputJsonValue,
          labelConfig: input.labelConfig as Prisma.InputJsonValue,
        },
      });

      await recordAudit(tx, admin, "QrCodeDesign", design.id, "CREATE", null, design);

      return design;
    });

    return NextResponse.json({ ok: true, design: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create QR code design", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
