import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusBadge } from "./StatusBadge";
import { BulkLabelPrint } from "./BulkLabelPrint";
import { OrderLabelButton } from "./OrderLabelButton";
import { BulkPakbonPrint } from "./BulkPakbonPrint";
import { OrderPakbonButton } from "./OrderPakbonButton";
import { OrderRefundBadge } from "./OrderRefundBadge";
import { MarketManifestPrint } from "./MarketManifestPrint";
import { publicOrderNumber } from "@/lib/order-reference";
import { formatAmsterdamDateTime } from "@/lib/amsterdam-calendar";
import {
  HANDLING_FILTERS,
  HANDLING_FILTER_LABELS,
  describeHandled,
  handlingWhere,
  isHandleable,
  parseHandlingFilter,
} from "@/lib/order-handling";
import { OrderHandlingControls } from "./OrderHandlingControls";

const shortDateTime = (date: Date) =>
  formatAmsterdamDateTime(date, "nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

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
  { label: "Terugbetaald", status: "REFUNDED" },
];

export default async function BestellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; afhandeling?: string }>;
}) {
  const { status, afhandeling } = await searchParams;
  const activeHandling = parseHandlingFilter(afhandeling);
  const activeStatus =
    status && VALID_STATUSES.has(status) ? (status as OrderStatus) : null;

  const [orders, handlingCounts] = await Promise.all([
    prisma.order.findMany({
    where: {
      ...(activeStatus ? { status: activeStatus } : {}),
      ...(activeHandling ? handlingWhere(activeHandling) : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      contactName: true,
      contactEmail: true,
      status: true,
      deliveryMethod: true,
      isTest: true,
      totalCents: true,
      createdAt: true,
      postnlTrackingCode: true,
      postnlLabelBase64: true,
      processedAt: true,
      processedByName: true,
      readyForPickupAt: true,
      readyForPickupByName: true,
      refunds: { select: { amountCents: true, status: true } },
    },
    }),
    Promise.all(HANDLING_FILTERS.map((filter) => prisma.order.count({ where: handlingWhere(filter) }))),
  ]);

  return (
    <div>
      <h1 className="text-heading-xl text-text">Bestellingen</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BulkLabelPrint />
        <BulkPakbonPrint />
      </div>

      <div className="mt-4">
        <MarketManifestPrint />
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

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Afhandeling">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Afhandeling</span>
        {HANDLING_FILTERS.map((filter, index) => {
          const active = filter === activeHandling;
          return (
            <Link
              key={filter}
              href={active ? "/admin/bestellingen" : `/admin/bestellingen?afhandeling=${filter}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-button border px-3 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                active ? "border-accent bg-accent text-contrast" : "border-border bg-surface text-text hover:border-border-hover"
              )}
            >
              {HANDLING_FILTER_LABELS[filter]}
              <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-contrast/15" : "bg-background text-muted")}>{handlingCounts[index]}</span>
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
                <th className="px-4 py-3 font-heading">Afhandeling</th>
                <th className="px-4 py-3 font-heading">Datum</th>
                <th className="px-4 py-3 font-heading">Trackingcode</th>
                <th className="px-4 py-3 font-heading">Documenten</th>
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
                      {publicOrderNumber(order)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text">{order.contactName}</div>
                    <div className="text-muted">{order.contactEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.status} />
                      <OrderRefundBadge totalCents={order.totalCents} refunds={order.refunds} />
                      {order.isTest ? (
                        <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">
                          Test
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isHandleable(order) ? (
                      <OrderHandlingControls
                        orderId={order.id}
                        isPickup={order.deliveryMethod === "PICKUP"}
                        processed={Boolean(order.processedAt)}
                        ready={Boolean(order.readyForPickupAt)}
                        processedNote={describeHandled(order.processedAt, order.processedByName, shortDateTime)}
                        readyNote={describeHandled(order.readyForPickupAt, order.readyForPickupByName, shortDateTime)}
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {formatAmsterdamDateTime(order.createdAt, "nl-NL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {order.deliveryMethod === "SHIPPING" && order.postnlTrackingCode ? (
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
                    {!order.isTest && (order.status === "PAID" || order.status === "FULFILLED") ? (
                      <div className="flex flex-wrap gap-1.5">
                        {order.deliveryMethod === "SHIPPING" ? (
                          <OrderLabelButton
                            orderId={order.id}
                            hasLabel={Boolean(order.postnlLabelBase64)}
                          />
                        ) : null}
                        <OrderPakbonButton orderId={order.id} />
                      </div>
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
