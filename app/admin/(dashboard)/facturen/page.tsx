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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const { country } = await searchParams;
  const activeCountry = country === "NL" || country === "BE" ? country : null;

  const invoices = await prisma.invoice.findMany({
    where: activeCountry ? { invoiceNumber: { startsWith: activeCountry } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { businessAccount: { select: { companyName: true, customerNumber: true } } },
  });

  const exportHref = activeCountry ? `/api/admin/invoices/export?country=${activeCountry}` : "/api/admin/invoices/export";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Facturen</h1>
          <p className="mt-1 text-body-sm text-muted">
            {invoices.length} {invoices.length === 1 ? "factuur" : "facturen"}
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button border border-border bg-surface px-5 font-heading font-bold text-text shadow-card sm:w-auto"
        >
          <Download className="h-5 w-5" aria-hidden="true" /> Exporteren (CSV)
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {COUNTRY_TABS.map((tab) => {
          const href = tab.country ? `/admin/facturen?country=${tab.country}` : "/admin/facturen";
          const active = tab.country === activeCountry;
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

      {invoices.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Geen facturen gevonden.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/admin/zakelijk/${invoice.businessAccountId}`}
                className="rounded-panel border border-border bg-surface p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-heading text-heading-sm text-text">{invoice.invoiceNumber}</span>
                  <span className="font-semibold text-text">{formatPrice(invoice.totalCents, "nl")}</span>
                </div>
                <p className="mt-1 text-body-sm text-muted">{invoice.businessAccount.companyName}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(invoice.createdAt)}</p>
              </Link>
            ))}
          </div>
          <div className="mt-6 hidden overflow-x-auto rounded-panel border border-border bg-surface md:block">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-heading">Factuurnummer</th>
                  <th className="px-4 py-3 font-heading">Klantnr.</th>
                  <th className="px-4 py-3 font-heading">Bedrijf</th>
                  <th className="px-4 py-3 font-heading">Datum</th>
                  <th className="px-4 py-3 text-right font-heading">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/zakelijk/${invoice.businessAccountId}`}
                        className="font-semibold text-accent-hover underline underline-offset-4"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{invoice.businessAccount.customerNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-text">{invoice.businessAccount.companyName}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(invoice.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-text">{formatPrice(invoice.totalCents, "nl")}</td>
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
