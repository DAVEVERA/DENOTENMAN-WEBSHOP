import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { InvoiceViewBeacon } from "@/components/admin-panel/developer/InvoiceViewBeacon";
import { OpenInvoicesPayPanel } from "@/components/admin-panel/developer/OpenInvoicesPayPanel";
import { statusBadgeFor } from "@/components/admin-panel/developer/invoice-status";
import { requireAdminPage } from "@/lib/developer-portal/page-auth";
import {
  confirmDeveloperInvoiceSession,
  confirmOpenDeveloperInvoicePayments,
  getDeveloperProfile,
  listDeveloperInvoices,
  processDeveloperInvoiceReminders,
  publicDeveloperProfile,
} from "@/lib/developer-portal/service";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Facturen ontwikkelaar", robots: { index: false, follow: false } };

const dateLabel = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" });

export default async function DeveloperInvoicesPage({ searchParams }: { searchParams: Promise<{ betaling?: string; session_id?: string }> }) {
  await connection();
  await requireAdminPage();
  const { betaling, session_id: sessionId } = await searchParams;

  // Back from Stripe: confirm the payment of every invoice it covered before listing.
  let paidNow: string[] = [];
  let paymentPending = false;
  if (betaling === "gelukt" && sessionId) {
    paidNow = await confirmDeveloperInvoiceSession(sessionId).catch(() => []);
    paymentPending = paidNow.length === 0;
  }

  // Payments that came in elsewhere (webhook missed, page closed) show as paid right away.
  await confirmOpenDeveloperInvoicePayments().catch(() => undefined);
  const [invoices, profile] = await Promise.all([listDeveloperInvoices({ publishedOnly: true }), getDeveloperProfile()]);
  const developer = publicDeveloperProfile(profile);
  // Safety net next to the daily job: confirms payments and sends due reminders.
  after(() => processDeveloperInvoiceReminders().catch((error) => console.error("Developer invoice reminders failed", error)));
  const open = invoices.filter((invoice) => invoice.status === "SENT");
  const paid = invoices.filter((invoice) => invoice.status === "PAID");

  return (
    <div className="grid gap-5">
      <InvoiceViewBeacon kind="OVERVIEW" />
      <div>
        <h1 className="text-heading-lg text-text sm:text-heading-xl">Facturen ontwikkelaar</h1>
        <p className="mt-2 max-w-3xl text-body-sm text-muted">Facturen van de ontwikkelaar van de webshop. Kies welke je betaalt; alles gaat in één betaling.</p>
      </div>

      {paidNow.length ? (
        <p role="status" className="flex items-center gap-2 rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Betaald: {paidNow.length} {paidNow.length === 1 ? "factuur" : "facturen"}. Dank je wel!</p>
      ) : null}
      {paymentPending ? (
        <p role="alert" className="rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900">De betaling is nog niet bevestigd door Stripe. Dat kan een paar minuten duren; ververs deze pagina straks.</p>
      ) : null}
      {betaling === "geannuleerd" ? (
        <p role="status" className="rounded-card border border-border bg-background p-3 text-body-sm text-text">De betaling is afgebroken. Je kunt het opnieuw proberen of het bedrag overmaken.</p>
      ) : null}

      {open.length ? (
        <OpenInvoicesPayPanel
          invoices={open.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            title: invoice.title,
            dueDate: invoice.dueDate,
            overdue: invoice.overdue,
            subtotalCents: invoice.subtotalCents,
            vatCents: invoice.vatCents,
            totalCents: invoice.totalCents,
            hasAttachment: Boolean(invoice.attachment),
          }))}
          payment={developer.payment}
        />
      ) : (
        <p className="rounded-panel border border-dashed border-border bg-background p-6 text-center text-body-sm text-muted">Er staan geen facturen open.</p>
      )}

      {paid.length ? (
        <section aria-labelledby="paid-title">
          <h2 id="paid-title" className="text-heading-sm font-bold text-text">Betaald</h2>
          <ul className="mt-3 grid gap-2">
            {paid.map((invoice) => {
              const badge = statusBadgeFor(invoice);
              return (
                <li key={invoice.id}>
                  <Link href={`/admin/ontwikkelaarsfacturen/${encodeURIComponent(invoice.id)}`} className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-hover">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-heading text-body-md font-bold text-text">{invoice.number}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span></span>
                      <span className="mt-1 block break-words text-body-sm text-text">{invoice.title}</span>
                      {invoice.paidAt ? <span className="mt-1 block text-xs text-muted">Betaald op {dateLabel.format(new Date(invoice.paidAt))}</span> : null}
                    </span>
                    <span className="font-heading text-heading-sm font-bold text-text">{formatPrice(invoice.totalCents, "nl")}</span>
                    <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
