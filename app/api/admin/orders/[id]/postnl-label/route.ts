import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";
import { createShipmentLabel, PostnlError } from "@/lib/postnl";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return isValidAdminSessionToken(token);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { postnlLabelBase64: true },
  });

  if (!order?.postnlLabelBase64) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const pdfBuffer = Buffer.from(order.postnlLabelBase64, "base64");

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="verzendlabel-${id}.pdf"`,
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const { barcode, labelBase64 } = await createShipmentLabel(order);

    await prisma.order.update({
      where: { id },
      data: { postnlTrackingCode: barcode, postnlLabelBase64: labelBase64 },
    });

    return NextResponse.json({ ok: true, barcode });
  } catch (error) {
    if (error instanceof PostnlError) {
      return NextResponse.json(
        { error: "POSTNL_ERROR", message: error.message, details: error.details },
        { status: 502 }
      );
    }
    console.error("Failed to create PostNL label", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
