import { NextResponse, type NextRequest } from "next/server";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession } from "@/lib/business-portal";
import { isValidBusinessInvoiceDownloadLink } from "@/lib/business-invoice-download";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  const signedLinkIsValid = isValidBusinessInvoiceDownloadLink(
    orderId,
    request.nextUrl.searchParams.get("expires"),
    request.nextUrl.searchParams.get("signature")
  );
  if (!session && !signedLinkIsValid) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: session
      ? { id: orderId, businessOrderList: { businessAccountId: session.businessAccountId } }
      : { id: orderId },
    include: { invoices: true },
  });
  const invoice = order?.invoices[0];
  if (!invoice?.pdfBase64) return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });

  const bytes = Buffer.from(invoice.pdfBase64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
