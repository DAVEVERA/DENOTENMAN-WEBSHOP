import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderCreateForm } from "./OrderCreateForm";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ origineel?: string }> }) {
  const { origineel } = await searchParams;
  const original = origineel ? await prisma.order.findUnique({ where: { id: origineel } }) : null;
  if (origineel && !original) notFound();
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    select: {
      id: true, sku: true, stock: true, priceCents: true,
      translations: { where: { locale: "nl" }, select: { label: true } },
      product: { select: { translations: { where: { locale: "nl" }, select: { name: true } } } },
    },
    orderBy: [{ product: { slug: "asc" } }, { weightGrams: "asc" }],
  });
  return <div className="max-w-4xl">
    <Link href={original ? `/admin/bestellingen/${original.id}` : "/admin/bestellingen"} className="text-body-sm font-semibold text-accent-hover underline">← Terug naar bestellingen</Link>
    <h1 className="mt-3 text-heading-xl text-text">{original ? "Nabestelling maken" : "Handmatige bestelling maken"}</h1>
    <p className="mt-2 text-body-sm text-muted">{original
      ? "Deze nabestelling wordt gekoppeld aan de oorspronkelijke order. Producten en verzending zijn voor rekening van De Notenman."
      : "Maak een bestelling aan voor een klant. De betaalstatus blijft open totdat een externe betaling is bevestigd."}</p>
    <OrderCreateForm
      original={original ? {
        id: original.id, orderNumber: original.orderNumber, contactName: original.contactName,
        contactEmail: original.contactEmail, deliveryMethod: original.deliveryMethod,
        shippingCity: original.shippingCity, pickupLocationId: original.pickupLocationId,
      } : null}
      variants={variants.map((variant) => ({
        id: variant.id, sku: variant.sku, stock: variant.stock, priceCents: variant.priceCents,
        label: `${variant.product.translations[0]?.name ?? variant.sku} · ${variant.translations[0]?.label ?? variant.sku}`,
      }))}
    />
  </div>;
}
