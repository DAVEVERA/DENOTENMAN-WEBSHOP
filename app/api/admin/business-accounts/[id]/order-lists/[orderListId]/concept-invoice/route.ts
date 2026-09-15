import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { renderConceptInvoicePdfBase64 } from "@/lib/business-invoice";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderListId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id, orderListId } = await context.params;
  const orderList = await prisma.businessOrderList.findFirst({
    where: { id: orderListId, businessAccountId: id },
    select: { id: true },
  });
  if (!orderList) return NextResponse.json({ error: "ORDER_LIST_NOT_FOUND" }, { status: 404 });

  try {
    const pdfBase64 = await renderConceptInvoicePdfBase64(orderListId);
    return new NextResponse(Buffer.from(pdfBase64, "base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="concept-factuur-${orderListId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`Failed to render concept invoice for order list ${orderListId}`, error);
    return NextResponse.json({ error: "RENDER_FAILED" }, { status: 500 });
  }
}
