import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession, recordBusinessEvent } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";
import { getPeppolAdapter, PeppolNotConfiguredError } from "@/lib/peppol";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const account = session.businessAccount;
  if (account.country !== "BE") return NextResponse.json({ error: "PEPPOL_NOT_APPLICABLE" }, { status: 409 });
  if (!account.peppolConfigured || !account.peppolParticipantId) {
    return NextResponse.json({ error: "PEPPOL_NOT_CONFIGURED" }, { status: 409 });
  }

  const { id } = await context.params;
  const orderList = await prisma.businessOrderList.findFirst({
    where: { id, businessAccountId: session.businessAccountId },
    include: { order: { include: { invoices: true } } },
  });
  const invoice = orderList?.order?.invoices[0];
  if (!invoice?.pdfBase64) return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });

  try {
    const result = await getPeppolAdapter().send({
      invoicePdfBase64: invoice.pdfBase64,
      invoiceNumber: invoice.invoiceNumber,
      recipientParticipantId: account.peppolParticipantId,
    });
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { peppolStatus: "SENT", peppolMessageId: result.messageId, peppolSentAt: new Date(), peppolError: null },
      });
      await recordBusinessEvent(tx, {
        businessAccountId: session.businessAccountId,
        type: "INVOICE_PEPPOL_SENT",
        actorType: "CUSTOMER",
        actorName: account.contactName,
        summary: `Factuur ${invoice.invoiceNumber} verstuurd naar Peppol`,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof PeppolNotConfiguredError ? error.message : error instanceof Error ? error.message : "Onbekende fout";
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoice.id }, data: { peppolStatus: "FAILED", peppolError: message.slice(0, 2000) } });
      await recordBusinessEvent(tx, {
        businessAccountId: session.businessAccountId,
        type: "INVOICE_PEPPOL_FAILED",
        actorType: "SYSTEM",
        actorName: "Systeem",
        summary: `Peppol-verzending van factuur ${invoice.invoiceNumber} mislukt`,
      });
    });
    const status = error instanceof PeppolNotConfiguredError ? 409 : 502;
    return NextResponse.json({ error: error instanceof PeppolNotConfiguredError ? "PEPPOL_NOT_CONFIGURED" : "PEPPOL_SEND_FAILED" }, { status });
  }
}
