import Link from "next/link";
import { notFound } from "next/navigation";
import type { BusinessAccountStatus, BusinessOrderListStatus, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BusinessAccountEditForm } from "./BusinessAccountEditForm";
import { QuoteRowActions } from "./QuoteRowActions";
import { BusinessInvitationButton } from "./BusinessInvitationButton";
import { BusinessOrderListActions } from "./BusinessOrderListActions";

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

const ORDER_LIST_STATUS_LABELS: Record<BusinessOrderListStatus, string> = {
  DRAFT: "Concept",
  SENT: "Wacht op klant",
  CHANGES_REQUESTED: "Klant heeft wijzigingen",
  APPROVED: "Goedgekeurd",
  CANCELLED: "Geannuleerd",
};

const ORDER_LIST_STATUS_CLASSES: Record<BusinessOrderListStatus, string> = {
  DRAFT: "bg-border text-muted",
  SENT: "bg-blue-50 text-blue-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-50 text-green-800",
  CANCELLED: "bg-red-50 text-red-700",
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
    include: {
      quotes: { orderBy: { createdAt: "desc" } },
      orderLists: { orderBy: { createdAt: "desc" }, include: { items: { orderBy: { sortOrder: "asc" } }, notes: { orderBy: { createdAt: "desc" } } } },
      invitations: { orderBy: { createdAt: "desc" }, take: 5 },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
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

          <section className="rounded-panel border border-border bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Klanttoegang</p>
            <h2 className="mt-1 font-heading text-heading-sm text-text">Persoonlijke uitnodiging</h2>
            <p className="mt-2 text-body-sm text-muted">De link is eenmalig, 72 uur geldig en opent alleen de omgeving van {businessAccount.companyName}.</p>
            <div className="mt-4"><BusinessInvitationButton businessAccountId={businessAccount.id} email={businessAccount.email} disabled={businessAccount.status !== "APPROVED"} /></div>
            {businessAccount.invitations.length > 0 ? (
              <ul className="mt-4 grid gap-2 text-body-sm">
                {businessAccount.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap justify-between gap-2 rounded-card bg-background px-3 py-2">
                    <span>{invitation.deliveryStatus === "ACCEPTED" ? "E-mail geaccepteerd" : invitation.deliveryStatus === "FAILED" ? "E-mail mislukt" : "Klaargezet"} · {formatDateTime(invitation.createdAt)}</span>
                    <span className="font-semibold text-muted">{invitation.acceptedAt ? "Geactiveerd" : invitation.revokedAt ? "Ingetrokken" : invitation.expiresAt < new Date() ? "Verlopen" : "Geldig"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Samen bestellen</p><h2 className="mt-1 font-heading text-heading-sm text-text">Bestellijsten</h2></div>
              <Link href={`/admin/zakelijk/${businessAccount.id}/bestellijsten/nieuw`} className="inline-flex min-h-11 w-full items-center justify-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button sm:w-auto">Nieuwe bestellijst</Link>
            </div>
            {businessAccount.orderLists.length === 0 ? <p className="mt-4 rounded-card border border-dashed border-border p-4 text-body-sm text-muted">Nog geen bestellijst. Maak een voorstel met echte productvarianten en afgesproken prijzen.</p> : (
              <div className="mt-4 grid gap-4">
                {businessAccount.orderLists.map((orderList) => (
                  <article key={orderList.id} className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-heading text-heading-sm text-text">{orderList.title}</h3><p className="mt-1 text-body-sm text-muted">{orderList.items.length} {orderList.items.length === 1 ? "regel" : "regels"} · {formatPrice(orderList.totalCents, "nl")}</p></div>
                      <span className={`rounded-button px-2 py-1 text-xs font-bold ${ORDER_LIST_STATUS_CLASSES[orderList.status]}`}>{ORDER_LIST_STATUS_LABELS[orderList.status]}</span>
                    </div>
                    <ul className="mt-4 divide-y divide-border rounded-card border border-border">
                      {orderList.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-body-sm"><span className="min-w-0"><strong className="block text-text">{item.productName}</strong><span className="text-muted">{item.variantLabel ?? item.sku ?? "Variant"}</span></span><span className="shrink-0 text-right"><strong className="block text-text">{item.quantity} × {formatPrice(item.unitPriceCents, "nl")}</strong><span className="text-muted">{formatPrice(item.quantity * item.unitPriceCents, "nl")}</span></span></li>)}
                    </ul>
                    {orderList.notes.length > 0 ? <div className="mt-3 rounded-card bg-[#FFF9DA] p-3 text-body-sm"><strong className="text-text">Laatste notitie van {orderList.notes[0].authorName}</strong><p className="mt-1 whitespace-pre-wrap text-muted">{orderList.notes[0].text}</p></div> : null}
                    {orderList.deliveryStatus === "FAILED" ? <p className="mt-3 rounded-card bg-red-50 p-3 text-body-sm font-semibold text-red-700">De klantmail is niet verzonden. Probeer opnieuw.</p> : null}
                    <BusinessOrderListActions accountId={businessAccount.id} orderListId={orderList.id} status={orderList.status} deliveryStatus={orderList.deliveryStatus} updatedAt={orderList.updatedAt.toISOString()} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-heading-sm text-text">Bestaande offertes</h2>
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
                <dt className="text-muted">Prijstier</dt>
                <dd className="text-text">{businessAccount.priceTier}</dd>
              </div>
              <div>
                <dt className="text-muted">Aangemaakt op</dt>
                <dd className="text-text">{formatDateTime(businessAccount.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-panel border border-border bg-surface p-5">
            <h2 className="font-heading text-heading-sm text-text">Gebeurtenissen</h2>
            <ol className="mt-3 grid gap-3 text-body-sm">
              {businessAccount.events.map((event) => <li key={event.id} className="border-l-2 border-accent pl-3"><p className="font-semibold text-text">{event.summary}</p><p className="mt-0.5 text-xs text-muted">{event.actorName} · {formatDateTime(event.createdAt)}</p></li>)}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
