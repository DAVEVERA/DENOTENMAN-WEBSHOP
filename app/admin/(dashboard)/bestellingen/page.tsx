import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusBadge } from "./StatusBadge";
import { BulkLabelPrint } from "./BulkLabelPrint";
import { OrderLabelButton } from "./OrderLabelButton";

const VALID_STATUSES = new Set<string>([
  "PENDING",
  "PAID",
  "FULFILLED",
  "CANCELLED",
  "REFUNDED",
]);

const STATUS_TABS: { label: string; status: OrderStatus | null }[] = [
  { label: "Alle", status: null },
  { label: "Openstaand", status: "PENDING" },
  { label: "Betaald", status: "PAID" },
  { label: "Verzonden", status: "FULFILLED" },
  { label: "Geannuleerd", status: "CANCELLED" },
];

export default async function BestellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus =
    status && VALID_STATUSES.has(status) ? (status as OrderStatus) : null;

  const orders = await prisma.order.findMany({
    where: activeStatus ? { status: activeStatus } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      contactName: true,
      contactEmail: true,
      status: true,
      totalCents: true,
      createdAt: true,
      postnlTrackingCode: true,
      postnlLabelBase64: true,
    },
  });

  return (
    <div>
      <h1 className="text-heading-xl text-text">Bestellingen</h1>

      <div className="mt-6">
        <BulkLabelPrint />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const href = tab.status ? `/admin/bestellingen?status=${tab.status}` : "/admin/bestellingen";
          const active = tab.status === activeStatus;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "rounded-button border border-border px-3 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                active
                  ? "border-accent bg-accent text-contrast"
                  : "bg-surface text-text hover:border-border-hover"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Geen bestellingen gevonden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Bestelnummer</th>
                <th className="px-4 py-3 font-heading">Klant</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 font-heading">Datum</th>
                <th className="px-4 py-3 font-heading">Trackingcode</th>
                <th className="px-4 py-3 font-heading">Label</th>
                <th className="px-4 py-3 text-right font-heading">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bestellingen/${order.id}`}
                      className="font-mono text-accent-hover underline underline-offset-4"
                    >
                      {order.id.slice(0, 10)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text">{order.contactName}</div>
                    <div className="text-muted">{order.contactEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat("nl-NL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {order.postnlTrackingCode ? (
                      <Link
                        href={`/admin/bestellingen/${order.id}`}
                        className="font-mono text-text underline decoration-border-hover underline-offset-4"
                      >
                        {order.postnlTrackingCode}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.status === "PAID" || order.status === "FULFILLED" ? (
                      <OrderLabelButton
                        orderId={order.id}
                        hasLabel={Boolean(order.postnlLabelBase64)}
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-text">
                    {formatPrice(order.totalCents, "nl")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
