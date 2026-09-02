import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getBusinessPortalSession } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentStatus } from "@/lib/orders";
import { Logo } from "@/components/ui/Logo";
import { BusinessPortalClient } from "./BusinessPortalClient";

export const metadata: Metadata = { title: "Zakelijke omgeving | De Notenman", robots: { index: false, follow: false } };

const COMPLETED_ORDER_STATUSES = ["PAID", "FULFILLED"] as const;

function orderListInclude() {
  return {
    items: { orderBy: { sortOrder: "asc" as const } },
    notes: { orderBy: { createdAt: "asc" as const } },
    // A list is continuous and accumulates one Order per checkout round, so
    // this is no longer a single row — newest first, so [0] is "last time".
    orders: { orderBy: { createdAt: "desc" as const }, include: { items: true } },
  };
}

async function loadOrderLists(businessAccountId: string) {
  let orderLists = await prisma.businessOrderList.findMany({
    where: { businessAccountId, status: { not: "DRAFT" } },
    orderBy: { updatedAt: "desc" },
    include: orderListInclude(),
  });

  // The customer may land back here before Mollie's webhook has confirmed
  // payment — or, without a public webhook URL, before anything ever will.
  // Verify pending orders the same way the consumer order-confirmation page
  // does, rather than only trusting whatever the webhook already wrote.
  const pendingOrders = orderLists.flatMap((list) => list.orders).filter((order) => order.status === "PENDING");
  if (pendingOrders.length > 0) {
    await Promise.all(pendingOrders.map((order) => syncOrderPaymentStatus(order)));
    orderLists = await prisma.businessOrderList.findMany({
      where: { businessAccountId, status: { not: "DRAFT" } },
      orderBy: { updatedAt: "desc" },
      include: orderListInclude(),
    });
  }

  return orderLists;
}

export default async function BusinessPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/nl/zakelijk");
  const session = await getBusinessPortalSession();
  if (!session) redirect(`/${locale}/zakelijk/inloggen`);
  const { country, vatRegime, vatRatePercent, vatNumber, peppolConfigured, peppolParticipantId } = session.businessAccount;
  const orderLists = await loadOrderLists(session.businessAccountId);
  const serialized = orderLists.map((list) => {
    const completedOrders = list.orders.filter((order) => COMPLETED_ORDER_STATUSES.includes(order.status as (typeof COMPLETED_ORDER_STATUSES)[number]));
    const lastCompletedOrder = completedOrders[0] ?? null;
    return {
      id: list.id,
      title: list.title,
      status: list.status,
      version: list.version,
      totalCents: list.totalCents,
      validUntil: list.validUntil?.toISOString() ?? null,
      sentAt: list.sentAt?.toISOString() ?? null,
      approvedAt: list.approvedAt?.toISOString() ?? null,
      // The customer may have just returned from Mollie before the webhook
      // has confirmed payment — never show "Nu afrekenen" again while that
      // is still settling, and never trust anything from the redirect URL.
      paymentPending: list.orders.some((order) => order.status === "PENDING"),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
      items: list.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantLabel: item.variantLabel,
        sku: item.sku,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        // Flags a line Fedor added after the customer's last completed
        // order, so it stands out from what's already been ordered before.
        isNew: lastCompletedOrder ? item.createdAt > lastCompletedOrder.createdAt : false,
      })),
      notes: list.notes.map((note) => ({
        id: note.id,
        actorType: note.actorType,
        authorName: note.authorName,
        text: note.text,
        createdAt: note.createdAt.toISOString(),
      })),
      orderHistory: completedOrders.map((order) => ({
        id: order.id,
        date: (order.paidAt ?? order.createdAt).toISOString(),
        totalCents: order.totalCents,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      })),
    };
  });
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface"><div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6"><Logo alt={{ mark: "De Notenman beeldmerk", wordmark: "De Notenman" }} parts="wordmark" size="nav" /><span className="rounded-button bg-background px-3 py-2 text-xs font-bold text-muted">Zakelijk</span></div></header>
      <BusinessPortalClient
        locale={locale}
        account={{
          companyName: session.businessAccount.companyName,
          contactName: session.businessAccount.contactName,
          country,
          vatRegime,
          vatRatePercent: Number(vatRatePercent),
          vatNumber,
          peppolConfigured,
          peppolParticipantId,
          hasPassword: Boolean(session.businessAccount.passwordHash),
        }}
        initialOrderLists={serialized}
      />
    </div>
  );
}
