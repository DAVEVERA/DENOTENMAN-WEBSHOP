import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { ArrowRight } from "lucide-react";

import { statusBadgeFor } from "@/components/admin-panel/developer/invoice-status";
import { requireAdminPage } from "@/lib/developer-portal/page-auth";
import { listDeveloperInvoices, processDeveloperInvoiceReminders } from "@/lib/developer-portal/service";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Facturen ontwikkelaar", robots: { index: false, follow: false } };

const dateLabel = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" });

export default async function DeveloperInvoicesPage() {
  await connection();
  await requireAdminPage();
  const invoices = await listDeveloperInvoices({ publishedOnly: true });
  // Safety net next to the daily job: confirms payments and sends due reminders.
  after(() => processDeveloperInvoiceReminders().catch((error) => console.error("Developer invoice reminders failed", error)));
  const open = invoices.filter((invoice) => invoice.status === "SENT");

  return (
    <div>
      <h1 className="text-heading-lg text-text sm:text-heading-xl">Facturen ontwikkelaar</h1>
      <p className="mt-2 max-w-3xl text-body-sm text-muted">Facturen van de ontwikkelaar van de webshop. Open een factuur om hem te bekijken, af te drukken of direct te betalen.</p>

      {open.length ? (
        <p role="status" className="mt-4 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900">
          {open.length === 1 ? "Er staat 1 factuur open" : `Er staan ${open.length} facturen open`}: {formatPrice(open.reduce((sum, invoice) => sum + invoice.totalCents, 0), "nl")}.
        </p>
      ) : null}

      {invoices.length ? (
        <ul className="mt-5 grid gap-3">
          {invoices.map((invoice) => {
            const badge = statusBadgeFor(invoice);
            return (
              <li key={invoice.id}>
                <Link href={`/admin/ontwikkelaarsfacturen/${encodeURIComponent(invoice.id)}`} className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-hover">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-heading text-body-md font-bold text-text">{invoice.number}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span></span>
                    <span className="mt-1 block break-words text-body-sm text-text">{invoice.title}</span>
                    <span className="mt-1 block text-xs text-muted">{invoice.status === "PAID" && invoice.paidAt ? `Betaald op ${dateLabel.format(new Date(invoice.paidAt))}` : `Uiterlijk betalen op ${dateLabel.format(new Date(invoice.dueDate))}`}</span>
                  </span>
                  <span className="font-heading text-heading-sm font-bold text-text">{formatPrice(invoice.totalCents, "nl")}</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-panel border border-dashed border-border bg-background p-6 text-center text-body-sm text-muted">Er zijn nog geen facturen.</p>
      )}
    </div>
  );
}
