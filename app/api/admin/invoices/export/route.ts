import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const country = request.nextUrl.searchParams.get("country");
  const where = country === "NL" || country === "BE" ? { invoiceNumber: { startsWith: country } } : {};

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { businessAccount: { select: { companyName: true, customerNumber: true, country: true } } },
  });

  const header = [
    "Factuurnummer",
    "Land",
    "Klantnummer",
    "Bedrijf",
    "Factuurdatum",
    "Subtotaal excl. BTW",
    "BTW-percentage",
    "BTW-bedrag",
    "Totaal incl. BTW",
    "BTW-regeling",
    "Peppol-status",
  ];

  const rows = invoices.map((invoice) =>
    [
      invoice.invoiceNumber,
      invoice.businessAccount.country,
      invoice.businessAccount.customerNumber ?? "",
      invoice.businessAccount.companyName,
      invoice.createdAt.toISOString().slice(0, 10),
      centsToAmount(invoice.subtotalCents),
      Number(invoice.vatRatePercent).toString(),
      centsToAmount(invoice.vatAmountCents),
      centsToAmount(invoice.totalCents),
      invoice.vatRegime === "REVERSE_CHARGE" ? "BTW verlegd" : "Standaard",
      invoice.peppolStatus,
    ]
      .map((cell) => csvCell(String(cell)))
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  const filename = country === "NL" || country === "BE" ? `facturen-${country}.csv` : "facturen-alle.csv";

  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
