import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { renderPackingSlipPdfBase64 } from "@/lib/packing-slip-pdf";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return (await verifyAdminSessionToken(token)) !== null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pdfBase64 = await renderPackingSlipPdfBase64({
    orderId: order.id,
    createdAt: order.createdAt,
    contactName: order.contactName,
    shippingStreet: order.shippingStreet,
    shippingHouseNumber: order.shippingHouseNumber,
    shippingPostalCode: order.shippingPostalCode,
    shippingCity: order.shippingCity,
    shippingCountry: order.shippingCountry,
    items: order.items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
    })),
  });

  return new NextResponse(Buffer.from(pdfBase64, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pakbon-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
