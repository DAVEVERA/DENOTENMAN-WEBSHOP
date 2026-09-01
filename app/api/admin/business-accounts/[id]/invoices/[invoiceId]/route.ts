import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id, invoiceId } = await context.params;
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessAccountId: id } });
  if (!invoice?.pdfBase64) return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });

  const bytes = Buffer.from(invoice.pdfBase64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
