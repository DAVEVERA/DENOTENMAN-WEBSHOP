import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { buildInvoiceCsv, exportFilename, parseExportPeriod, type ExportType } from "@/lib/invoice-export";
import { buildInvoicePdf, buildInvoiceXlsx, exportScopeLabel, invoiceExportTables } from "@/lib/invoice-export-documents";

export const runtime = "nodejs";

// Export of the invoices page as CSV, Excel or PDF: business invoices, private orders
// or both, optionally limited to NL/BE and to a month, quarter, half-year or year.
// Excel and PDF end every table with a totals line; with both categories Excel gets
// one tab per category plus an overview.
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
  const formatParam = params.get("format");
  const format = formatParam === "xlsx" || formatParam === "pdf" ? formatParam : "csv";

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

  const businessRows = invoices.map((invoice) => ({
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
    }));
  const orderRows = orders.map((order) => ({
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
    }));

  const filename = exportFilename(type, country, period).replace(/\.csv$/u, `.${format}`);
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" };
  if (format === "csv") {
    return new NextResponse(buildInvoiceCsv(type, businessRows, orderRows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const tables = invoiceExportTables(type, businessRows, orderRows);
  if (format === "xlsx") {
    return new NextResponse(new Uint8Array(buildInvoiceXlsx(tables)), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }
  const pdf = await buildInvoicePdf(tables, { title: "Facturen De Notenman", scope: exportScopeLabel(type, country, period), generatedAt: new Date() });
  return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
