import Link from "next/link";
import { notFound } from "next/navigation";
import type { BusinessOrderListStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BusinessAccountSections } from "./BusinessAccountSections";
import { BusinessInvitationButton } from "./BusinessInvitationButton";
import { BusinessOrderListActions } from "./BusinessOrderListActions";
import { BusinessOrderRegenerateInvoiceButton } from "./BusinessOrderRegenerateInvoiceButton";

const ORDER_LIST_STATUS_LABELS: Record<BusinessOrderListStatus, string> = {
  DRAFT: "Concept",
  SENT: "Wacht op klant",
  CHANGES_REQUESTED: "Klant heeft wijzigingen",
  APPROVED: "Goedgekeurd",
  PAID: "Betaald",
  CANCELLED: "Geannuleerd",
};

const ORDER_LIST_STATUS_CLASSES: Record<BusinessOrderListStatus, string> = {
  DRAFT: "bg-border text-muted",
  SENT: "bg-blue-50 text-blue-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-50 text-green-800",
  PAID: "bg-green-100 text-green-900",
  CANCELLED: "bg-red-50 text-red-700",
};

const PICKUP_LOCATION_LABELS: Record<string, string> = {
  hilvarenbeek: "Hilvarenbeek",
  uden: "Uden",
  antwerpen: "Antwerpen",
  haaren: "Haaren (NB)",
};

const PICKUP_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Wekelijks",
  BIWEEKLY: "Om de week",
  MONTHLY: "Maandelijks",
  ON_REQUEST: "Op aanvraag",
};

function formatAddress(
  street: string | null,
  houseNumber: string | null,
  postalCode: string | null,
  city: string | null,
  country: string | null,
): string {
  const line1 = [street, houseNumber].filter(Boolean).join(" ");
  const line2 = [postalCode, city].filter(Boolean).join(" ");
  const parts = [line1, line2, country].filter(
    (part) => part && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : "—";
}

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
      orderLists: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          notes: { orderBy: { createdAt: "desc" } },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              businessCancellationRequests: {
                orderBy: { createdAt: "desc" },
                include: { items: true },
              },
            },
          },
        },
      },
      invitations: { orderBy: { createdAt: "desc" }, take: 5 },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!businessAccount) {
    notFound();
  }

  return (
    <div>
      <div>
        <Link
          href="/admin/zakelijk"
          className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
        >
          ← Alle zakelijke accounts
        </Link>
        <h1 className="mt-2 text-heading-lg text-text">
          {businessAccount.companyName}
        </h1>
        {businessAccount.customerNumber ? (
          <p className="mt-1 text-body-sm font-semibold text-muted">
            Klantnr. {businessAccount.customerNumber}
          </p>
        ) : null}
      </div>

      <BusinessAccountSections
        businessAccountId={businessAccount.id}
        currentStatus={businessAccount.status}
        isDeleted={businessAccount.deletedAt !== null}
        initialNotes={businessAccount.notes ?? ""}
        currentCompanyName={businessAccount.companyName}
        currentContactName={businessAccount.contactName}
        currentEmail={businessAccount.email}
        currentPhone={businessAccount.phone ?? ""}
        currentCustomerNumber={businessAccount.customerNumber ?? ""}
        currentVatNumber={businessAccount.vatNumber ?? ""}
        currentKvkNumber={businessAccount.kvkNumber ?? ""}
        currentCountry={businessAccount.country === "BE" ? "BE" : "NL"}
        currentVatRegime={businessAccount.vatRegime}
        currentVatRatePercent={Number(businessAccount.vatRatePercent)}
        currentPeppolParticipantId={businessAccount.peppolParticipantId ?? ""}
        currentShippingEnabled={businessAccount.shippingEnabled}
        currentFixedPickupLocationId={businessAccount.fixedPickupLocationId}
        currentPickupFrequency={businessAccount.pickupFrequency}
        currentBillingAddress={{
          street: businessAccount.billingStreet ?? "",
          houseNumber: businessAccount.billingHouseNumber ?? "",
          postalCode: businessAccount.billingPostalCode ?? "",
          city: businessAccount.billingCity ?? "",
          country: businessAccount.billingCountry ?? "",
        }}
        currentShippingAddress={{
          street: businessAccount.shippingStreet ?? "",
          houseNumber: businessAccount.shippingHouseNumber ?? "",
          postalCode: businessAccount.shippingPostalCode ?? "",
          city: businessAccount.shippingCity ?? "",
          country: businessAccount.shippingCountry ?? "",
        }}
        personalInvitation={
          <div>
            <p className="mt-2 text-body-sm text-muted">
              De link is eenmalig, 72 uur geldig en opent alleen de omgeving van{" "}
              {businessAccount.companyName}.
            </p>
            <div className="mt-4">
              <BusinessInvitationButton
                businessAccountId={businessAccount.id}
                email={businessAccount.email}
                disabled={businessAccount.status !== "APPROVED"}
              />
            </div>
            {businessAccount.invitations.length > 0 ? (
              <ul className="mt-4 grid gap-2 text-body-sm">
                {businessAccount.invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap justify-between gap-2 rounded-card bg-background px-3 py-2"
                  >
                    <span>
                      {invitation.deliveryStatus === "ACCEPTED"
                        ? "E-mail geaccepteerd"
                        : invitation.deliveryStatus === "FAILED"
                          ? "E-mail mislukt"
                          : "Klaargezet"}{" "}
                      · {formatDateTime(invitation.createdAt)}
                    </span>
                    <span className="font-semibold text-muted">
                      {invitation.acceptedAt
                        ? "Geactiveerd"
                        : invitation.revokedAt
                          ? "Ingetrokken"
                          : invitation.expiresAt < new Date()
                            ? "Verlopen"
                            : "Geldig"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        }

        orderLists={
          <div>
            <div className="flex flex-wrap items-end justify-end gap-3">
              <Link
                href={`/admin/zakelijk/${businessAccount.id}/bestellijsten/nieuw`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button sm:w-auto"
              >
                Nieuwe bestellijst
              </Link>
            </div>
            {businessAccount.orderLists.length === 0 ? (
              <p className="mt-4 rounded-card border border-dashed border-border p-4 text-body-sm text-muted">
                Nog geen bestellijst. Maak een voorstel met echte
                productvarianten en afgesproken prijzen.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {businessAccount.orderLists.map((orderList) => (
                  <article
                    key={orderList.id}
                    className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-heading-sm text-text">
                          {orderList.title}
                        </h3>
                        <p className="mt-1 text-body-sm text-muted">
                          {orderList.items.length}{" "}
                          {orderList.items.length === 1 ? "regel" : "regels"} ·{" "}
                          {formatPrice(orderList.totalCents, "nl")}
                        </p>
                        {orderList.pickupDay ? (
                          <p className="mt-1 text-body-sm font-semibold text-accent-hover">
                            Voorkeursdag ophalen:{" "}
                            {new Intl.DateTimeFormat("nl-NL", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            }).format(orderList.pickupDay)}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-button px-2 py-1 text-xs font-bold ${ORDER_LIST_STATUS_CLASSES[orderList.status]}`}
                      >
                        {ORDER_LIST_STATUS_LABELS[orderList.status]}
                      </span>
                    </div>
                    <ul className="mt-4 divide-y divide-border rounded-card border border-border">
                      {orderList.items.map((item) => {
                        const onRequest =
                          item.priceOnRequest || item.unitPriceCents === null;
                        return (
                          <li
                            key={item.id}
                            className="flex items-start justify-between gap-3 px-3 py-2 text-body-sm"
                          >
                            <span className="min-w-0">
                              <strong className="block text-text">
                                {item.productName}
                              </strong>
                              <span className="text-muted">
                                {item.variantLabel ?? item.sku ?? "Variant"}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              {onRequest ? (
                                <strong className="block text-amber-800">
                                  {item.quantity} × prijs op aanvraag
                                </strong>
                              ) : (
                                <>
                                  <strong className="block text-text">
                                    {item.quantity} ×{" "}
                                    {formatPrice(item.unitPriceCents!, "nl")}
                                  </strong>
                                  <span className="text-muted">
                                    {formatPrice(
                                      item.quantity * item.unitPriceCents!,
                                      "nl",
                                    )}
                                  </span>
                                </>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {orderList.notes.length > 0 ? (
                      <div className="mt-3 rounded-card bg-[#FFF9DA] p-3 text-body-sm">
                        <strong className="text-text">
                          Laatste notitie van {orderList.notes[0].authorName}
                        </strong>
                        <p className="mt-1 whitespace-pre-wrap text-muted">
                          {orderList.notes[0].text}
                        </p>
                      </div>
                    ) : null}
                    {orderList.orders.some((order) =>
                      ["PAID", "FULFILLED", "REFUNDED", "CANCELLED"].includes(
                        order.status,
                      ),
                    ) ? (
                      <div className="mt-3 rounded-card border border-border bg-background p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          Eerdere bestellingen
                        </p>
                        <ul className="mt-2 grid gap-2 text-body-sm">
                          {orderList.orders
                            .filter((order) =>
                              [
                                "PAID",
                                "FULFILLED",
                                "REFUNDED",
                                "CANCELLED",
                              ].includes(order.status),
                            )
                            .map((order) => (
                              <li
                                key={order.id}
                                className="rounded-card border border-border bg-surface px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-muted">
                                    {order.paidAt
                                      ? formatDateTime(order.paidAt)
                                      : formatDateTime(order.createdAt)}
                                  </span>
                                  <span className="font-semibold text-text">
                                    {formatPrice(order.totalCents, "nl")}
                                  </span>
                                </div>
                                {order.businessCancellationRequests.some(
                                  (request) => request.status === "PENDING",
                                ) ? (
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-card bg-amber-50 px-3 py-2 text-amber-900">
                                    <strong>
                                      Annuleringsaanvraag voor{" "}
                                      {order.businessCancellationRequests
                                        .filter(
                                          (request) =>
                                            request.status === "PENDING",
                                        )
                                        .flatMap((request) => request.items)
                                        .reduce(
                                          (sum, item) => sum + item.quantity,
                                          0,
                                        )}{" "}
                                      artikel(en)
                                    </strong>
                                    <Link
                                      href={`/admin/bestellingen/${order.id}`}
                                      className="font-heading font-bold underline underline-offset-4"
                                    >
                                      Bestelling beoordelen
                                    </Link>
                                  </div>
                                ) : null}
                                {(order.status === "PAID" || order.status === "FULFILLED") &&
                                !businessAccount.invoices.some(
                                  (invoice) => invoice.orderId === order.id,
                                ) ? (
                                  <div className="mt-2 rounded-card bg-red-50 px-3 py-2">
                                    <p className="text-xs font-semibold text-red-700">
                                      Geen factuur gevonden voor deze bestelling.
                                    </p>
                                    <BusinessOrderRegenerateInvoiceButton
                                      businessAccountId={businessAccount.id}
                                      orderId={order.id}
                                    />
                                  </div>
                                ) : null}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                    {orderList.deliveryStatus === "FAILED" ? (
                      <p className="mt-3 rounded-card bg-red-50 p-3 text-body-sm font-semibold text-red-700">
                        De klantmail is niet verzonden. Probeer opnieuw.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/zakelijk/${businessAccount.id}/bestellijsten/${orderList.id}/bewerken`}
                        className="inline-flex min-h-11 items-center rounded-button border border-border px-4 font-heading text-body-sm font-bold text-text"
                      >
                        Bewerken
                      </Link>
                    </div>
                    <BusinessOrderListActions
                      accountId={businessAccount.id}
                      orderListId={orderList.id}
                      status={orderList.status}
                      deliveryStatus={orderList.deliveryStatus}
                      updatedAt={orderList.updatedAt.toISOString()}
                      hasPendingOrder={orderList.orders.some(
                        (order) => order.status === "PENDING",
                      )}
                    />
                  </article>
                ))}
              </div>
            )}
          </div>
        }
        contactCompanyOverview={
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-border bg-background p-4">
              <h2 className="font-heading text-heading-sm text-text">
                Contactgegevens
              </h2>
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
                  <dt className="text-muted">Aangemaakt op</dt>
                  <dd className="text-text">
                    {formatDateTime(businessAccount.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-border bg-background p-4">
              <h2 className="font-heading text-heading-sm text-text">
                Bedrijfsgegevens &amp; BTW
              </h2>
              <dl className="mt-3 space-y-2 text-body-sm">
                <div>
                  <dt className="text-muted">KVK-nummer</dt>
                  <dd className="text-text">
                    {businessAccount.kvkNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">BTW-nummer</dt>
                  <dd className="text-text">
                    {businessAccount.vatNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Land</dt>
                  <dd className="text-text">
                    {businessAccount.country === "BE" ? "België" : "Nederland"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">BTW-percentage</dt>
                  <dd className="text-text">
                    {Number(businessAccount.vatRatePercent)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">BTW-regeling</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-button px-2 py-1 text-xs font-semibold",
                        businessAccount.vatRegime === "REVERSE_CHARGE"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-border text-muted",
                      )}
                    >
                      {businessAccount.vatRegime === "REVERSE_CHARGE"
                        ? "BTW verlegd"
                        : "Standaard"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Peppol</dt>
                  <dd className="text-text">
                    {businessAccount.peppolConfigured
                      ? businessAccount.peppolParticipantId ?? "Geregistreerd, ID nog niet ingevuld"
                      : "Niet geregistreerd"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Zakelijke nieuwsbrief</dt>
                  <dd className="text-text">
                    {businessAccount.businessNewsletterOptIn
                      ? `Toestemming vastgelegd${businessAccount.businessNewsletterConsentAt ? ` op ${formatDateTime(businessAccount.businessNewsletterConsentAt)}` : ""}`
                      : "Niet aangemeld"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        }
        deliveryOverview={
          <div className="rounded-card border border-border bg-background p-4">
            <h3 className="font-heading text-heading-sm text-text">
              Levering &amp; adressen
            </h3>
            <dl className="mt-3 space-y-3 text-body-sm">
              <div>
                <dt className="text-muted">Vaste afhaallocatie</dt>
                <dd className="text-text">
                  {businessAccount.fixedPickupLocationId
                    ? PICKUP_LOCATION_LABELS[businessAccount.fixedPickupLocationId] ?? businessAccount.fixedPickupLocationId
                    : "Geen vaste locatie"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Afhaalfrequentie</dt>
                <dd className="text-text">
                  {businessAccount.pickupFrequency
                    ? PICKUP_FREQUENCY_LABELS[businessAccount.pickupFrequency]
                    : "Geen vast ritme"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Verzending</dt>
                <dd>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-button px-2 py-1 text-xs font-semibold",
                      businessAccount.shippingEnabled
                        ? "bg-accent/10 text-accent-hover"
                        : "bg-border text-muted",
                    )}
                  >
                    {businessAccount.shippingEnabled
                      ? "Aan"
                      : "Uit — klant haalt af op de markt"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Verzendadres</dt>
                <dd className="text-text">
                  {formatAddress(
                    businessAccount.shippingStreet,
                    businessAccount.shippingHouseNumber,
                    businessAccount.shippingPostalCode,
                    businessAccount.shippingCity,
                    businessAccount.shippingCountry,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Factuuradres</dt>
                <dd className="text-text">
                  {formatAddress(
                    businessAccount.billingStreet,
                    businessAccount.billingHouseNumber,
                    businessAccount.billingPostalCode,
                    businessAccount.billingCity,
                    businessAccount.billingCountry,
                  )}
                </dd>
              </div>
            </dl>
          </div>
        }
        invoices={
          <div>
            {businessAccount.invoices.length === 0 ? (
              <p className="mt-3 text-body-sm text-muted">
                Nog geen facturen. Deze verschijnen zodra een bestellijst is
                betaald.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 text-body-sm">
                {businessAccount.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-background px-3 py-2"
                  >
                    <span>
                      <strong className="text-text">
                        {invoice.invoiceNumber}
                      </strong>
                      <span className="ml-2 text-muted">
                        {formatPrice(invoice.totalCents, "nl")}
                      </span>
                      {invoice.peppolStatus !== "NOT_APPLICABLE" ? (
                        <span
                          className={cn(
                            "ml-2 inline-flex items-center rounded-button px-2 py-0.5 text-xs font-semibold",
                            invoice.peppolStatus === "SENT"
                              ? "bg-green-50 text-green-800"
                              : invoice.peppolStatus === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-border text-muted",
                          )}
                        >
                          Peppol:{" "}
                          {invoice.peppolStatus === "SENT"
                            ? "verstuurd"
                            : invoice.peppolStatus === "FAILED"
                              ? "mislukt"
                              : "nog niet verstuurd"}
                        </span>
                      ) : null}
                    </span>
                    <a
                      href={`/api/admin/business-accounts/${businessAccount.id}/invoices/${invoice.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-heading text-body-sm font-bold text-accent-hover underline underline-offset-4"
                    >
                      Downloaden
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
        events={
          <ol className="mt-3 grid gap-3 text-body-sm">
            {businessAccount.events.map((event) => (
              <li key={event.id} className="border-l-2 border-accent pl-3">
                <p className="font-semibold text-text">{event.summary}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {event.actorName} · {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        }
      />
    </div>
  );
}
