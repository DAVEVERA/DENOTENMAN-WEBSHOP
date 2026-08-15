import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductAdminForm } from "@/components/admin-panel/ProductAdminForm";

export default async function NewProductPage() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      include: { translations: { where: { locale: "nl" } } },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({
      include: { translations: { where: { locale: "nl" } } },
      orderBy: { slug: "asc" },
    }),
  ]);
  const categoryOptions = categories
    .map((category) => ({ id: category.id, parentId: category.parentId, name: category.translations[0]?.name }))
    .filter((category): category is { id: string; parentId: string | null; name: string } => Boolean(category.name));
  const productOptions = products
    .map((product) => ({ id: product.id, name: product.translations[0]?.name }))
    .filter((product): product is { id: string; name: string } => Boolean(product.name));

  return <div>
    <Link href="/admin/producten" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar producten</Link>
    <div className="mt-3"><h1 className="text-heading-xl text-text">Nieuw product</h1><p className="mt-1 text-body-sm text-muted">Maak eerst het product aan; daarna kun je afbeeldingen uploaden en de AI-audit uitvoeren.</p></div>
    <div className="mt-8"><ProductAdminForm
      mode="create"
      initial={{
        sku: "", slug: "", name: "", shortDescription: "", description: "",
        basePriceEuro: "0.00", salePriceEuro: "", unit: "WEIGHT", isActive: false,
        categoryIds: [], recommendationIds: [],
        variants: [{ clientKey: "new-variant-1", sku: "", label: "", weightGrams: "250", preparation: "RAW", salting: "UNSALTED", coating: "NONE", isActive: true, priceEuro: "0.00", salePriceEuro: "", stock: "0" }],
      }}
      categories={categoryOptions}
      productOptions={productOptions}
      images={[]}
    /></div>
  </div>;
}
