import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryEditForm } from "./CategoryEditForm";
import { collectDescendantCategoryIds } from "@/lib/category-hierarchy";

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      translations: true,
      productCategories: {
        include: {
          product: { include: { translations: true } },
        },
      },
    },
  });

  if (!category) {
    notFound();
  }

  const nl = category.translations.find((t) => t.locale === "nl");

  const categoryGraph = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const excludedParentIds = collectDescendantCategoryIds(id, categoryGraph);
  const parentOptions = await prisma.category.findMany({
    where: {
      id: { notIn: excludedParentIds },
      type: "STANDARD",
      isActive: true,
    },
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });

  const products = category.productCategories
    .map(({ product }) => {
      const productNl = product.translations.find((t) => t.locale === "nl");
      return {
        id: product.id,
        name: productNl?.name ?? product.sku,
        isActive: product.isActive,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return (
    <div>
      <div className="flex items-center gap-2 text-body-sm text-muted">
        <Link
          href="/admin/categorieen"
          className="underline underline-offset-4 hover:text-text"
        >
          Categorieën
        </Link>
        <span>/</span>
        <span className="text-text">{nl?.name ?? category.slug}</span>
      </div>
      <h1 className="mt-2 text-heading-xl text-text">{nl?.name ?? category.slug}</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CategoryEditForm
            category={{
              id: category.id,
              name: nl?.name ?? "",
              description: nl?.description ?? "",
              sortOrder: category.sortOrder,
              isActive: category.isActive,
              parentId: category.parentId,
            }}
            parentOptions={parentOptions.map((parent) => ({
              id: parent.id,
              name:
                `${parent.parentId ? "↳ " : ""}${parent.translations.find((t) => t.locale === "nl")?.name ?? parent.slug}`,
            }))}
          />
        </div>

        <div>
          <h2 className="text-heading-md text-text">Producten in deze categorie</h2>
          <p className="mt-1 text-body-sm text-muted">
            {products.length} {products.length === 1 ? "product" : "producten"}
          </p>

          {products.length === 0 ? (
            <p className="mt-4 text-body-sm text-muted">
              Geen producten gekoppeld aan deze categorie.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-panel border border-border bg-surface">
              {products.map((product) => (
                <li key={product.id} className="px-4 py-3 text-body-sm">
                  <Link
                    href={`/admin/producten/${product.id}`}
                    className="text-accent-hover underline underline-offset-4"
                  >
                    {product.name}
                  </Link>
                  {!product.isActive ? (
                    <span className="ml-2 text-muted">(inactief)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
