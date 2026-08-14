import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicImageUrl } from "@/lib/storage";
import { ProductEditForm } from "./ProductEditForm";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      translations: true,
      images: true,
      variants: { include: { translations: true }, orderBy: { sku: "asc" } },
      productCategories: {
        include: { category: { include: { translations: true } } },
        orderBy: [{ category: { type: "asc" } }, { category: { sortOrder: "asc" } }],
      },
    },
  });

  if (!product) {
    notFound();
  }

  const nlTranslation = product.translations.find((translation) => translation.locale === "nl");

  const activeCategoryLink =
    product.productCategories.find((link) => link.category.isActive) ?? product.productCategories[0];
  const categoryName =
    activeCategoryLink?.category.translations.find((translation) => translation.locale === "nl")
      ?.name ?? null;

  const images = [...product.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({
      id: image.id,
      url: publicImageUrl(image.storageKey),
      alt: image.alt,
      isPrimary: image.isPrimary,
    }));

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: variant.translations.find((translation) => translation.locale === "nl")?.label ?? null,
    weightGrams: variant.weightGrams,
    preparation: variant.preparation as string,
    salting: variant.salting as string,
    coating: variant.coating as string,
    isActive: variant.isActive,
    priceCents: variant.priceCents,
    stock: variant.stock,
  }));

  return (
    <div>
      <Link
        href="/admin/producten"
        className="text-body-sm text-accent-hover underline underline-offset-4"
      >
        ← Terug naar producten
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">{nlTranslation?.name ?? product.slug}</h1>
          <p className="mt-1 text-body-sm text-muted">
            SKU {product.sku} · Slug {product.slug}
            {categoryName ? ` · ${categoryName}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ProductEditForm
          productId={product.id}
          basePriceCents={product.basePriceCents}
          unit={product.unit}
          isActive={product.isActive}
          name={nlTranslation?.name ?? ""}
          description={nlTranslation?.description ?? ""}
          hasNlTranslation={Boolean(nlTranslation)}
          variants={variants}
          images={images}
        />
      </div>
    </div>
  );
}
