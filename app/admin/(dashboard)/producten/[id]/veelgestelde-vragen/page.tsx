import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditorNav } from "@/components/admin-panel/ProductEditorNav";
import { ProductFaqEditor } from "@/components/admin-panel/ProductFaqEditor";
import { prisma } from "@/lib/prisma";

export default async function ProductFaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      slug: true,
      translations: { where: { locale: "nl" }, select: { name: true }, take: 1 },
    },
  });

  if (!product) notFound();

  return (
    <div>
      <Link
        href="/admin/producten"
        className="inline-flex min-h-11 items-center text-body-sm font-semibold text-text underline decoration-accent underline-offset-4"
      >
        ← Terug naar producten
      </Link>
      <div className="mt-3 min-w-0">
        <h1 className="break-words text-heading-xl text-text [overflow-wrap:anywhere]">
          {product.translations[0]?.name ?? product.slug}
        </h1>
        <p className="mt-1 text-body-sm text-muted">SKU {product.sku} · Veelgestelde vragen</p>
      </div>

      <ProductEditorNav productId={product.id} active="faq" />

      <div className="mt-8">
        <ProductFaqEditor productId={product.id} />
      </div>
    </div>
  );
}
