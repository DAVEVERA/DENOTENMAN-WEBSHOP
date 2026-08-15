import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductAdminForm } from "@/components/admin-panel/ProductAdminForm";

const productLocales = ["nl", "en", "fr"] as const;

function emptyTranslation(locale: (typeof productLocales)[number]) {
  return {
    locale,
    slug: "",
    name: "",
    shortDescription: "",
    description: "",
    descriptionHtml: "",
    seoTitle: "",
    metaDescription: "",
    promotionText: "",
  };
}

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
  const initialProduct = {
    sku: "", slug: "", name: "", shortDescription: "", description: "",
    basePriceEuro: "0.00", salePriceEuro: "", unit: "WEIGHT" as const, isActive: false,
    categoryIds: [], recommendationIds: [],
    variants: [{ clientKey: "new-variant-1", sku: "", label: "", weightGrams: "250", preparation: "RAW" as const, salting: "UNSALTED" as const, coating: "NONE" as const, isActive: true, priceEuro: "0.00", salePriceEuro: "", stock: "0" }],
    translations: {
      nl: emptyTranslation("nl"),
      en: emptyTranslation("en"),
      fr: emptyTranslation("fr"),
    },
    nutrition: {
      "nutrition.energyKj": "",
      "nutrition.energyKcal": "",
      "nutrition.fat": "",
      "nutrition.saturatedFat": "",
      "nutrition.carbohydrates": "",
      "nutrition.sugars": "",
      "nutrition.fiber": "",
      "nutrition.protein": "",
      "nutrition.salt": "",
    },
    categories: [],
    imageOrder: [],
  };

  return <div>
    <Link href="/admin/producten" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar producten</Link>
    <div className="mt-3"><h1 className="text-heading-xl text-text">Nieuw product</h1><p className="mt-1 text-body-sm text-muted">Maak eerst het product aan; daarna kun je afbeeldingen uploaden en de AI-audit uitvoeren.</p></div>
    <div className="mt-8"><ProductAdminForm
      mode="create"
      initial={initialProduct}
      categories={categoryOptions}
      productOptions={productOptions}
      images={[]}
    /></div>
  </div>;
}
