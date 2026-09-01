import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BusinessOrderListForm } from "../../BusinessOrderListForm";
import { BusinessOrderListActions } from "../../../BusinessOrderListActions";

const FROZEN_STATUSES = new Set(["PAID", "CANCELLED"]);

export default async function BestellijstBewerkenPage({
  params,
}: {
  params: Promise<{ id: string; orderListId: string }>;
}) {
  const { id, orderListId } = await params;

  const [account, orderList, variants] = await Promise.all([
    prisma.businessAccount.findUnique({ where: { id }, select: { id: true, companyName: true } }),
    prisma.businessOrderList.findFirst({
      where: { id: orderListId, businessAccountId: id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      include: {
        product: { select: { translations: { where: { locale: "nl" }, select: { name: true } } } },
        translations: { where: { locale: "nl" }, select: { label: true } },
      },
      orderBy: { sku: "asc" },
    }),
  ]);
  if (!account || !orderList) notFound();

  const options = variants
    .map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.product.translations[0]?.name ?? variant.sku,
      label: variant.translations[0]?.label ?? `${variant.weightGrams} gram`,
      priceCents: variant.salePriceCents ?? variant.priceCents,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/zakelijk/${account.id}`} className="inline-flex min-h-11 items-center font-heading text-body-sm font-bold text-accent-hover underline underline-offset-4">
        ← Terug naar {account.companyName}
      </Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Bestellijst bewerken</p>
      <h1 className="mt-1 text-heading-lg text-text">{orderList.title}</h1>

      {FROZEN_STATUSES.has(orderList.status) ? (
        <p role="alert" className="mt-5 rounded-card border border-border bg-background p-4 text-body-sm text-muted">
          {orderList.status === "PAID"
            ? "Deze bestellijst is al betaald en kan niet meer worden gewijzigd. Correcties horen in een nieuwe lijst."
            : "Deze bestellijst is geannuleerd en kan niet meer worden gewijzigd."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-body-sm text-muted">
            {orderList.status === "SENT"
              ? "De klant heeft deze lijst al ontvangen. Wijzigingen zijn direct zichtbaar zodra je opslaat."
              : "Dit concept heeft de klant nog niet gezien."}
          </p>
          <BusinessOrderListForm
            accountId={account.id}
            options={options}
            mode="edit"
            existingList={{
              id: orderList.id,
              version: orderList.version,
              status: orderList.status,
              title: orderList.title,
              validUntil: orderList.validUntil ? orderList.validUntil.toISOString() : null,
              items: orderList.items,
            }}
          />
          {orderList.status !== "DRAFT" ? (
            <div className="mt-6 rounded-card border border-red-200 bg-red-50 p-4">
              <p className="text-body-sm font-semibold text-red-900">Bestellijst annuleren</p>
              <p className="mt-1 text-body-sm text-red-800">Annuleren verwijdert niets — de lijst blijft zichtbaar met status “Geannuleerd”.</p>
              <BusinessOrderListActions
                accountId={account.id}
                orderListId={orderList.id}
                status={orderList.status}
                deliveryStatus={orderList.deliveryStatus}
                updatedAt={orderList.updatedAt.toISOString()}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
