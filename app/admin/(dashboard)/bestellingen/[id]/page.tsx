import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentStatus } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";
import { OrderEditForm } from "./OrderEditForm";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    notFound();
  }

  // syncOrderPaymentStatus re-verifies payment status against Mollie directly
  // rather than trusting the stored status column — the single source of
  // truth for "did this order get paid". Its return type doesn't carry
  // `items` (it's typed against the base `Order` model), so we reattach the
  // items we already fetched, same pattern as findOrderForLookup in lib/orders.ts.
  const synced = await syncOrderPaymentStatus(existing);
  const order = { ...synced, items: existing.items };

  const shippingLines = [
    `${order.shippingStreet} ${order.shippingHouseNumber}`,
    `${order.shippingPostalCode} ${order.shippingCity}`,
    order.shippingCountry,
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/bestellingen"
            className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
          >
            ← Alle bestellingen
          </Link>
          <h1 className="mt-2 font-mono text-heading-lg text-text">{order.id}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-panel border border-border bg-surface">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-heading">Product</th>
                  <th className="px-4 py-3 font-heading">Variant</th>
                  <th className="px-4 py-3 text-right font-heading">Aantal</th>
                  <th className="px-4 py-3 text-right font-heading">Prijs</th>
                  <th className="px-4 py-3 text-right font-heading">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{item.productName}</td>
                    <td className="px-4 py-3 text-muted">{item.variantLabel}</td>
                    <td className="px-4 py-3 text-right text-text">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-text">
                      {formatPrice(item.unitPriceCents, "nl")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatPrice(item.unitPriceCents * item.quantity, "nl")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-border px-4 py-3">
              <div className="flex justify-between text-body-sm text-muted">
                <span>Subtotaal</span>
                <span>{formatPrice(order.subtotalCents, "nl")}</span>
              </div>
              <div className="mt-1 flex justify-between text-body-sm text-muted">
                <span>Verzending</span>
                <span>{formatPrice(order.shippingCents, "nl")}</span>
              </div>
              <div className="mt-2 flex justify-between font-heading text-heading-sm font-semibold text-text">
                <span>Totaal</span>
                <span>{formatPrice(order.totalCents, "nl")}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-panel border border-border bg-surface p-5">
            <OrderEditForm
              orderId={order.id}
              initialTrackingCode={order.postnlTrackingCode ?? ""}
              hasLabel={Boolean(order.postnlLabelBase64)}
              currentStatus={order.status}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-panel border border-border bg-surface p-5">
            <h2 className="font-heading text-heading-sm text-text">Betaling</h2>
            <dl className="mt-3 space-y-2 text-body-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={order.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Betaald op</dt>
                <dd className="text-text">
                  {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Besteld op</dt>
                <dd className="text-text">{formatDateTime(order.createdAt)}</dd>
              </div>
              {order.molliePaymentId ? (
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-muted">Mollie ID</dt>
                  <dd className="truncate font-mono text-text" title={order.molliePaymentId}>
                    {order.molliePaymentId}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-panel border border-border bg-surface p-5">
            <h2 className="font-heading text-heading-sm text-text">Klantgegevens</h2>
            <dl className="mt-3 space-y-2 text-body-sm">
              <div>
                <dt className="text-muted">Naam</dt>
                <dd className="text-text">{order.contactName}</dd>
              </div>
              <div>
                <dt className="text-muted">E-mail</dt>
                <dd className="text-text">{order.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-muted">Telefoon</dt>
                <dd className="text-text">{order.contactPhone ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-panel border border-border bg-surface p-5">
            <h2 className="font-heading text-heading-sm text-text">Verzendadres</h2>
            <address className="mt-3 text-body-sm not-italic text-text">
              {shippingLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </address>
          </div>
        </div>
      </div>
    </div>
  );
}
