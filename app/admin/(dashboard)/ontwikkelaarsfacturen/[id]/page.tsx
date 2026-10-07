import { BankPaymentCard } from "@/components/admin-panel/developer/BankPaymentCard";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, ExternalLink, Paperclip } from "lucide-react";

import { DeveloperInvoiceDocument } from "@/components/admin-panel/developer/DeveloperInvoiceDocument";
import { InvoiceViewBeacon } from "@/components/admin-panel/developer/InvoiceViewBeacon";
import { PayDeveloperInvoiceButton, PrintInvoiceButton } from "@/components/admin-panel/developer/PayDeveloperInvoice";
import { statusBadgeFor } from "@/components/admin-panel/developer/invoice-status";
import { requireAdminPage } from "@/lib/developer-portal/page-auth";
import {
  confirmDeveloperInvoiceCheckout,
  confirmOpenDeveloperInvoicePayments,
  DeveloperInvoiceError,
  getDeveloperInvoice,
  getDeveloperProfile,
  publicDeveloperProfile,
} from "@/lib/developer-portal/service";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Factuur ontwikkelaar", robots: { index: false, follow: false } };

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors";

export default async function DeveloperInvoicePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ betaling?: string; session_id?: string }>;
}) {
  await connection();
  await requireAdminPage();
  const { id } = await params;
  const { betaling, session_id: sessionId } = await searchParams;

  // Back from Stripe: confirm the payment before showing the invoice.
  let paymentCheckFailed = false;
  if (betaling === "gelukt" && sessionId) {
    paymentCheckFailed = !(await confirmDeveloperInvoiceCheckout(id, sessionId).catch(() => false));
  } else {
    await confirmOpenDeveloperInvoicePayments().catch(() => undefined);
  }

  let invoice;
  try {
    invoice = await getDeveloperInvoice(id, { publishedOnly: true });
  } catch (error) {
    if (error instanceof DeveloperInvoiceError && error.status === 404) notFound();
    throw error;
  }
  const developer = publicDeveloperProfile(await getDeveloperProfile());
  const badge = statusBadgeFor(invoice);
  const open = invoice.status === "SENT";
  const amount = formatPrice(invoice.totalCents, "nl");

  return (
    <div className="grid gap-5">
      <InvoiceViewBeacon kind="INVOICE" invoiceId={invoice.id} />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/ontwikkelaarsfacturen" className="inline-flex min-h-11 items-center gap-2 font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Alle facturen</Link>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
      </div>

      {invoice.status === "PAID" ? (
        <p role="status" className="flex items-center gap-2 rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800 print:hidden"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Deze factuur is betaald. Dank je wel!</p>
      ) : null}
      {betaling === "geannuleerd" && open ? (
        <p role="status" className="rounded-card border border-border bg-background p-3 text-body-sm text-text print:hidden">De betaling is afgebroken. Je kunt het opnieuw proberen of het bedrag overmaken.</p>
      ) : null}
      {paymentCheckFailed && open ? (
        <p role="alert" className="rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900 print:hidden">De betaling is nog niet bevestigd door Stripe. Dat kan een paar minuten duren; ververs deze pagina straks.</p>
      ) : null}

      {open ? (
        <section className="grid gap-3 rounded-panel border border-accent-ink bg-surface p-4 shadow-card sm:p-5 print:hidden" aria-labelledby="pay-title">
          <h2 id="pay-title" className="text-heading-sm font-bold text-text">{amount} betalen{invoice.overdue ? " (vervaldatum is verstreken)" : ""}</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            {developer.payment.stripe ? <PayDeveloperInvoiceButton invoiceId={invoice.id} amountLabel={amount} /> : null}
            {developer.payment.link ? (
              <a href={developer.payment.link.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass} border border-border bg-surface text-text`}><ExternalLink className="h-4 w-4" aria-hidden="true" />{developer.payment.link.label || "Betaallink openen"}</a>
            ) : null}
          </div>
          {developer.payment.bankTransfer ? (
            <BankPaymentCard iban={developer.payment.bankTransfer.iban} accountHolder={developer.payment.bankTransfer.accountHolder} amountCents={invoice.totalCents} invoiceNumbers={[invoice.number]} />
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintInvoiceButton />
        {invoice.attachment ? (
          <a href={`/api/admin/developer-invoices/${encodeURIComponent(invoice.id)}/attachment`} target="_blank" rel="noopener" className={`${buttonClass} border border-border bg-surface text-text`}><Paperclip className="h-4 w-4" aria-hidden="true" />Originele factuur ({invoice.attachment.filename})</a>
        ) : null}
      </div>
      <DeveloperInvoiceDocument invoice={invoice} developer={developer} />
    </div>
  );
}
