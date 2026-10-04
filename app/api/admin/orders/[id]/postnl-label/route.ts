import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { PostnlError } from "@/lib/postnl";
import { ensurePostnlLabel, PostnlLabelGuardError } from "@/lib/postnl-labels";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { allowsPostnlForDeliveryMethod } from "@/lib/aftersales/order-state";
import { can } from "@/lib/roles";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { deliveryMethod: true, postnlLabelBase64: true },
  });

  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!allowsPostnlForDeliveryMethod(order.deliveryMethod)) {
    return NextResponse.json(
      { error: "ORDER_NOT_SHIPPABLE", message: "Een afhaalbestelling heeft geen PostNL-label." },
      { status: 409 }
    );
  }
  if (!order.postnlLabelBase64) {
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
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(admin.role, "orders", "write")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const label = await ensurePostnlLabel(id);
    return NextResponse.json({
      ok: true,
      barcode: label.barcode,
      reused: label.reused,
    });
  } catch (error) {
    if (error instanceof PostnlLabelGuardError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "ORDER_NOT_FOUND" ? 404 : 409 }
      );
    }
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
