import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BusinessOrderListCreateForm } from "./BusinessOrderListCreateForm";

export default async function NieuweBestellijstPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, variants] = await Promise.all([
    prisma.businessAccount.findUnique({ where: { id }, select: { id: true, companyName: true, status: true } }),
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      include: { product: { select: { translations: { where: { locale: "nl" }, select: { name: true } } } }, translations: { where: { locale: "nl" }, select: { label: true } } },
      orderBy: { sku: "asc" },
    }),
  ]);
  if (!account) notFound();

  const options = variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.product.translations[0]?.name ?? variant.sku,
    label: variant.translations[0]?.label ?? `${variant.weightGrams} gram`,
    priceCents: variant.salePriceCents ?? variant.priceCents,
  })).sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/zakelijk/${account.id}`} className="inline-flex min-h-11 items-center font-heading text-body-sm font-bold text-accent-hover underline underline-offset-4">← Terug naar {account.companyName}</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Nieuwe bestellijst</p>
      <h1 className="mt-1 text-heading-lg text-text">Voorstel voor {account.companyName}</h1>
      <p className="mt-2 text-body-sm text-muted">Kies echte webshopvarianten. Namen en SKU’s worden als momentopname bewaard; de klant kan alleen aantallen aanpassen.</p>
      {account.status !== "APPROVED" ? <p role="alert" className="mt-5 rounded-card border border-amber-300 bg-amber-50 p-4 text-body-sm font-semibold text-amber-900">Keur dit account eerst goed.</p> : <BusinessOrderListCreateForm accountId={account.id} options={options} />}
    </div>
  );
}
