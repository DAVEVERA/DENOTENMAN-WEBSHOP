import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getBusinessPortalSession } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/ui/Logo";
import { BusinessPortalClient } from "./BusinessPortalClient";

export const metadata: Metadata = { title: "Zakelijke omgeving | De Notenman", robots: { index: false, follow: false } };

export default async function BusinessPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/nl/zakelijk");
  const session = await getBusinessPortalSession();
  if (!session) redirect(`/${locale}/zakelijk/inloggen`);
  const orderLists = await prisma.businessOrderList.findMany({
    where: { businessAccountId: session.businessAccountId, status: { not: "DRAFT" } },
    orderBy: { updatedAt: "desc" },
    include: { items: { orderBy: { sortOrder: "asc" } }, notes: { orderBy: { createdAt: "asc" } } },
  });
  const serialized = orderLists.map((list) => ({
    id: list.id,
    title: list.title,
    status: list.status,
    version: list.version,
    totalCents: list.totalCents,
    validUntil: list.validUntil?.toISOString() ?? null,
    sentAt: list.sentAt?.toISOString() ?? null,
    approvedAt: list.approvedAt?.toISOString() ?? null,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: list.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    notes: list.notes.map((note) => ({
      id: note.id,
      actorType: note.actorType,
      authorName: note.authorName,
      text: note.text,
      createdAt: note.createdAt.toISOString(),
    })),
  }));
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface"><div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6"><Logo alt={{ mark: "De Notenman beeldmerk", wordmark: "De Notenman" }} parts="wordmark" size="nav" /><span className="rounded-button bg-background px-3 py-2 text-xs font-bold text-muted">Zakelijk</span></div></header>
      <BusinessPortalClient locale={locale} account={{ companyName: session.businessAccount.companyName, contactName: session.businessAccount.contactName }} initialOrderLists={serialized} />
    </div>
  );
}
