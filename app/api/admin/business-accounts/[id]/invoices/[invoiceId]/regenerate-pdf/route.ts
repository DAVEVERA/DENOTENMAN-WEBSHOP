import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { prisma } from "@/lib/prisma";
import { regenerateInvoicePdf } from "@/lib/business-invoice";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const { id, invoiceId } = await context.params;
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessAccountId: id } });
  if (!invoice) return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });

  try {
    const updated = await regenerateInvoicePdf(invoiceId);
    return NextResponse.json({ ok: true, invoiceId: updated.id });
  } catch (error) {
    console.error(`Failed to regenerate PDF for invoice ${invoiceId}`, error);
    return NextResponse.json({ error: "REGENERATE_FAILED" }, { status: 500 });
  }
}
