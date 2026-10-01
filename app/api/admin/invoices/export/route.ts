import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { buildInvoiceCsv, exportFilename, parseExportPeriod, type ExportType } from "@/lib/invoice-export";

// CSV export of the invoices page: business invoices, private orders or both,
// optionally limited to NL/BE and to a month, quarter, half-year or year.
export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const countryParam = params.get("country");
  const country = countryParam === "NL" || countryParam === "BE" ? countryParam : null;
  const typeParam = params.get("type");
  // Without a type this export used to mean business invoices only; that stays the same.
  const type: ExportType = typeParam === "particulier" ? "particulier" : typeParam === "alle" ? "alle" : "zakelijk";
  const periodParam = params.get("periode");
  const period = parseExportPeriod(periodParam);
  if (periodParam && !period) return NextResponse.json({ error: "INVALID_PERIOD" }, { status: 400 });
  const createdAt = period ? { gte: period.from, lt: period.to } : undefined;

  const [invoices, orders] = await Promise.all([
    type === "particulier"
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          where: { ...(country ? { invoiceNumber: { startsWith: country } } : {}), ...(createdAt ? { createdAt } : {}) },
          orderBy: { createdAt: "asc" },
          include: { businessAccount: { select: { companyName: true, customerNumber: true, country: true } } },
        }),
    type === "zakelijk"
      ? Promise.resolve([])
      : prisma.order.findMany({
          // The same selection as the "Particulier" list on the invoices page.
          where: {
            businessOrderListId: null,
            isTest: false,
            status: { in: ["PAID", "FULFILLED"] },
            ...(country ? { shippingCountry: country } : {}),
            ...(createdAt ? { createdAt } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: {
            orderNumber: true, id: true, shippingCountry: true, contactName: true, contactEmail: true, createdAt: true, paidAt: true, status: true,
            subtotalCents: true, discountCents: true, shippingCents: true, totalCents: true,
            refunds: { where: { status: "REFUNDED" }, select: { amountCents: true } },
          },
        }),
  ]);

  const csv = buildInvoiceCsv(
    type,
    invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      country: invoice.businessAccount.country,
      customerNumber: invoice.businessAccount.customerNumber,
      companyName: invoice.businessAccount.companyName,
      createdAt: invoice.createdAt,
      subtotalCents: invoice.subtotalCents,
      vatRatePercent: Number(invoice.vatRatePercent),
      vatAmountCents: invoice.vatAmountCents,
      totalCents: invoice.totalCents,
      vatRegime: invoice.vatRegime,
      peppolStatus: invoice.peppolStatus,
    })),
    orders.map((order) => ({
      orderNumber: order.orderNumber ?? order.id,
      country: order.shippingCountry,
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      status: order.status,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      refundedCents: order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(type, country, period)}"`,
      "Cache-Control": "no-store",
    },
  });
}
