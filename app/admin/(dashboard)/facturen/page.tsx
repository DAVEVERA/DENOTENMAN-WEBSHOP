import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

const COUNTRY_TABS: { label: string; country: "NL" | "BE" | null }[] = [
  { label: "Alle", country: null },
  { label: "Nederland (NL)", country: "NL" },
  { label: "België (BE)", country: "BE" },
];

const TYPE_TABS: { label: string; type: "zakelijk" | "particulier" | null }[] = [
  { label: "Alle", type: null },
  { label: "Zakelijk", type: "zakelijk" },
  { label: "Particulier", type: "particulier" },
];

type Row = {
  key: string;
  kind: "zakelijk" | "particulier";
  number: string;
  customer: string;
  createdAt: Date;
  totalCents: number;
  href: string;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; type?: string }>;
}) {
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const { country, type } = await searchParams;
  const activeCountry = country === "NL" || country === "BE" ? country : null;
  const activeType = type === "zakelijk" || type === "particulier" ? type : null;

  const [invoices, privateOrders] = await Promise.all([
    activeType === "particulier"
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          where: activeCountry ? { invoiceNumber: { startsWith: activeCountry } } : undefined,
          orderBy: { createdAt: "desc" },
          include: { businessAccount: { select: { companyName: true, customerNumber: true } } },
        }),
    activeType === "zakelijk"
      ? Promise.resolve([])
      : prisma.order.findMany({
          where: {
            businessOrderListId: null,
            isTest: false,
            status: { in: ["PAID", "FULFILLED"] },
            ...(activeCountry ? { shippingCountry: activeCountry } : {}),
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, contactName: true, totalCents: true, createdAt: true },
        }),
  ]);

  const rows: Row[] = [
    ...invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      kind: "zakelijk" as const,
      number: invoice.invoiceNumber,
      customer: invoice.businessAccount.companyName,
      createdAt: invoice.createdAt,
      totalCents: invoice.totalCents,
      href: `/admin/zakelijk/${invoice.businessAccountId}`,
    })),
    ...privateOrders.map((order) => ({
      key: `order-${order.id}`,
      kind: "particulier" as const,
      number: order.id.slice(0, 10),
      customer: order.contactName,
      createdAt: order.createdAt,
      totalCents: order.totalCents,
      href: `/admin/bestellingen/${order.id}`,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const exportHref = activeCountry ? `/api/admin/invoices/export?country=${activeCountry}` : "/api/admin/invoices/export";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Facturen</h1>
          <p className="mt-1 text-body-sm text-muted">
            {rows.length} {rows.length === 1 ? "resultaat" : "resultaten"}
          </p>
        </div>
        {activeType !== "particulier" ? (
          <a
            href={exportHref}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button border border-border bg-surface px-5 font-heading font-bold text-text shadow-card sm:w-auto"
          >
            <Download className="h-5 w-5" aria-hidden="true" /> Exporteren (CSV)
          </a>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (tab.type) params.set("type", tab.type);
          if (activeCountry) params.set("country", activeCountry);
          const query = params.toString();
          const href = query ? `/admin/facturen?${query}` : "/admin/facturen";
          const active = tab.type === activeType;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "rounded-button border border-border px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                active ? "border-accent bg-accent text-contrast" : "bg-surface text-text hover:border-border-hover"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {COUNTRY_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (activeType) params.set("type", activeType);
          if (tab.country) params.set("country", tab.country);
          const query = params.toString();
          const href = query ? `/admin/facturen?${query}` : "/admin/facturen";
          const active = tab.country === activeCountry;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "rounded-button border border-border px-3 py-1.5 text-body-sm font-semibold transition-colors duration-hover-fast",
                active ? "border-accent-hover bg-accent/10 text-accent-hover" : "bg-surface text-muted hover:border-border-hover"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Geen resultaten gevonden.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {rows.map((row) => (
              <Link key={row.key} href={row.href} className="rounded-panel border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-heading text-heading-sm text-text">{row.number}</span>
                  <span className="font-semibold text-text">{formatPrice(row.totalCents, "nl")}</span>
                </div>
                <p className="mt-1 text-body-sm text-muted">{row.customer}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {formatDate(row.createdAt)}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      row.kind === "zakelijk" ? "bg-accent/10 text-accent-hover" : "bg-border text-text"
                    )}
                  >
                    {row.kind === "zakelijk" ? "Zakelijk" : "Particulier"}
                  </span>
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 hidden overflow-x-auto rounded-panel border border-border bg-surface md:block">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-heading">Nummer</th>
                  <th className="px-4 py-3 font-heading">Klant</th>
                  <th className="px-4 py-3 font-heading">Type</th>
                  <th className="px-4 py-3 font-heading">Datum</th>
                  <th className="px-4 py-3 text-right font-heading">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <Link href={row.href} className="font-semibold text-accent-hover underline underline-offset-4">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text">{row.customer}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          row.kind === "zakelijk" ? "bg-accent/10 text-accent-hover" : "bg-border text-text"
                        )}
                      >
                        {row.kind === "zakelijk" ? "Zakelijk" : "Particulier"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-text">{formatPrice(row.totalCents, "nl")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
