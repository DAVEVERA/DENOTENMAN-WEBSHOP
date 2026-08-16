import Link from "next/link";
import { notFound } from "next/navigation";
import type { BusinessAccountStatus, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BusinessAccountEditForm } from "./BusinessAccountEditForm";
import { QuoteRowActions } from "./QuoteRowActions";

const STATUS_LABELS: Record<BusinessAccountStatus, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  SUSPENDED: "Geschorst",
};

const STATUS_BADGE_CLASSES: Record<BusinessAccountStatus, string> = {
  PENDING: "bg-border text-muted",
  APPROVED: "bg-accent/10 text-accent-hover",
  REJECTED: "bg-red-50 text-red-700",
  SUSPENDED: "bg-violet-50 text-violet-800",
};

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Afgewezen",
};

const QUOTE_STATUS_BADGE_CLASSES: Record<QuoteStatus, string> = {
  DRAFT: "bg-border text-muted",
  SENT: "bg-accent/10 text-accent-hover",
  ACCEPTED: "bg-green-50 text-green-700",
  DECLINED: "bg-red-50 text-red-700",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ZakelijkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const businessAccount = await prisma.businessAccount.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "desc" } } },
  });

  if (!businessAccount) {
    notFound();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/zakelijk"
            className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
          >
            ← Alle zakelijke accounts
          </Link>
          <h1 className="mt-2 text-heading-lg text-text">{businessAccount.companyName}</h1>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-button px-3 py-1 text-body-sm font-semibold",
            STATUS_BADGE_CLASSES[businessAccount.status]
          )}
        >
          {STATUS_LABELS[businessAccount.status]}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-panel border border-border bg-surface p-5">
            <BusinessAccountEditForm
              businessAccountId={businessAccount.id}
              currentStatus={businessAccount.status}
              currentPriceTier={businessAccount.priceTier}
              initialNotes={businessAccount.notes ?? ""}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-heading-sm text-text">Offertes</h2>
              <Link
                href={`/admin/zakelijk/${businessAccount.id}/offertes/nieuw`}
                className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button"
              >
                Nieuwe offerte
              </Link>
            </div>

            {businessAccount.quotes.length === 0 ? (
              <p className="mt-4 text-body-sm text-muted">Nog geen offertes voor dit account.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-panel border border-border bg-surface">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="px-4 py-3 font-heading">Status</th>
                      <th className="px-4 py-3 text-right font-heading">Totaal</th>
                      <th className="px-4 py-3 font-heading">Geldig tot</th>
                      <th className="px-4 py-3 font-heading">Aangemaakt</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {businessAccount.quotes.map((quote) => (
                      <tr key={quote.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-button px-2 py-1 text-xs font-semibold",
                              QUOTE_STATUS_BADGE_CLASSES[quote.status]
                            )}
                          >
                            {QUOTE_STATUS_LABELS[quote.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-text">
                          {formatPrice(quote.totalCents, "nl")}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {quote.validUntil ? formatDate(quote.validUntil, "nl") : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDateTime(quote.createdAt)}</td>
                        <td className="px-4 py-3">
                          <QuoteRowActions
                            businessAccountId={businessAccount.id}
                            quoteId={quote.id}
                            status={quote.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-panel border border-border bg-surface p-5">
            <h2 className="font-heading text-heading-sm text-text">Bedrijfsgegevens</h2>
            <dl className="mt-3 space-y-2 text-body-sm">
              <div>
                <dt className="text-muted">Contactpersoon</dt>
                <dd className="text-text">{businessAccount.contactName}</dd>
              </div>
              <div>
                <dt className="text-muted">E-mail</dt>
                <dd className="text-text">{businessAccount.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Telefoon</dt>
                <dd className="text-text">{businessAccount.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">BTW-nummer</dt>
                <dd className="text-text">{businessAccount.vatNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Prijstier</dt>
                <dd className="text-text">{businessAccount.priceTier}</dd>
              </div>
              <div>
                <dt className="text-muted">Aangemaakt op</dt>
                <dd className="text-text">{formatDateTime(businessAccount.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
