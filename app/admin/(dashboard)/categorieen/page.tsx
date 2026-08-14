import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/cn";
import type { CategoryType } from "@prisma/client";

const typeLabels: Record<CategoryType, string> = {
  STANDARD: "Standaard",
  PROMOTIONAL: "Actie",
};

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    include: {
      translations: true,
      children: {
        include: {
          translations: true,
          _count: { select: { productCategories: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { productCategories: true } },
    },
    where: { parentId: null },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const totalCount =
    categories.length + categories.reduce((sum, category) => sum + category.children.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Categorieën</h1>
          <p className="mt-1 text-body-sm text-muted">{totalCount} categorieën in totaal</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <p className="mt-6 text-body-sm text-muted">Nog geen categorieën.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-heading">Naam</th>
                <th className="px-4 py-3 font-heading">Slug</th>
                <th className="px-4 py-3 font-heading">Type</th>
                <th className="px-4 py-3 text-right font-heading">Producten</th>
                <th className="px-4 py-3 font-heading">Status</th>
                <th className="px-4 py-3 text-right font-heading">Sortering</th>
                <th className="px-4 py-3 font-heading">
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const nl = category.translations.find((t) => t.locale === "nl");

                return (
                  <Fragment key={category.id}>
                    <CategoryRow
                      id={category.id}
                      name={nl?.name ?? category.slug}
                      slug={category.slug}
                      type={category.type}
                      productCount={category._count.productCategories}
                      isActive={category.isActive}
                      sortOrder={category.sortOrder}
                    />
                    {category.children.map((child) => {
                      const childNl = child.translations.find((t) => t.locale === "nl");

                      return (
                        <CategoryRow
                          key={child.id}
                          id={child.id}
                          name={childNl?.name ?? child.slug}
                          slug={child.slug}
                          type={child.type}
                          productCount={child._count.productCategories}
                          isActive={child.isActive}
                          sortOrder={child.sortOrder}
                          isChild
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  id,
  name,
  slug,
  type,
  productCount,
  isActive,
  sortOrder,
  isChild = false,
}: {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  productCount: number;
  isActive: boolean;
  sortOrder: number;
  isChild?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        !isActive && "bg-background/60 text-muted"
      )}
    >
      <td className="px-4 py-3">
        <span
          className={cn(
            "flex items-center gap-2",
            isChild && "pl-6 text-muted",
            !isChild && "font-heading font-semibold text-text",
            !isActive && "text-muted"
          )}
        >
          {isChild ? <span aria-hidden="true">↳</span> : null}
          {name}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-muted">{slug}</td>
      <td className="px-4 py-3 text-text">{typeLabels[type]}</td>
      <td className="px-4 py-3 text-right text-text">{productCount}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-button px-2 py-1 text-body-sm font-heading font-semibold",
            isActive ? "bg-accent/10 text-accent-hover" : "bg-border text-muted"
          )}
        >
          {isActive ? "Actief" : "Inactief"}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-text">{sortOrder}</td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/categorieen/${id}`}
          className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
        >
          Bewerken
        </Link>
      </td>
    </tr>
  );
}
