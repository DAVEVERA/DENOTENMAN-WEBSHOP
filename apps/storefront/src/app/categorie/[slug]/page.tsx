import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { serverApiClient } from "@/lib/server-api";
import type { Product } from "@denotenman/schemas";

// TODO(@fullstack-dev): replace once CategoryDetailSchema lands in @denotenman/schemas
interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: { slug: string; name: string };
  children: CategoryDetail[];
}

// TODO(@fullstack-dev): replace once CategoryDetailSchema lands in @denotenman/schemas
interface RawCategoryMeta {
  name: string;
  description: string | null;
}

const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function fetchCategory(slug: string): Promise<CategoryDetail | null> {
  const res = await fetch(`${API_URL}/v1/categories/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {return null;}
  return res.json() as Promise<CategoryDetail>;
}

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await fetch(`${API_URL}/v1/categories/${encodeURIComponent(params.slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {return { title: "Categorie" };}
  const cat = (await res.json()) as RawCategoryMeta;
  return {
    title: cat.name,
    description: cat.description ?? `Ontdek ${cat.name} bij DeNotenman`,
  };
}

export const revalidate = 60;

export default async function CategoryPage({ params, searchParams }: Props) {
  const page = Number(searchParams.page ?? "1");

  const api = serverApiClient();
  const [category, products] = await Promise.all([
    fetchCategory(params.slug),
    api.products.list({ category: params.slug, page, pageSize: 12 }).catch(() => null),
  ]);

  if (!category || !products) {
    notFound();
  }

  const totalPages = Math.ceil(products.total / products.pageSize);
  const typedItems: Product[] = products.items;

  return (
    <div className="py-8">
      <div className="container-shop">
        <nav aria-label="Kruimelpad" className="mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
            <li>
              <Link href="/" className="hover:text-brand-green-600">
                Home
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" />
            {category.parent && (
              <>
                <li>
                  <Link
                    href={`/categorie/${category.parent.slug}`}
                    className="hover:text-brand-green-600"
                  >
                    {category.parent.name}
                  </Link>
                </li>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
            <li className="font-medium text-neutral-900">{category.name}</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">{category.name}</h1>
        {category.description && (
          <p className="mb-8 text-neutral-600 max-w-2xl">{category.description}</p>
        )}

        {category.children.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {category.children.map((c) => (
              <Link
                key={c.id}
                href={`/categorie/${c.slug}`}
                className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:border-brand-green-300 hover:bg-brand-green-50 hover:text-brand-green-700 transition-all"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {typedItems.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-neutral-500">{products.total} producten</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {typedItems.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav aria-label="Paginering" className="mt-10 flex justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/categorie/${params.slug}?page=${p}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === products.page ? "bg-brand-green text-white" : "bg-white text-neutral-700 border border-neutral-200 hover:bg-brand-green-50"}`}
                    aria-current={p === products.page ? "page" : undefined}
                  >
                    {p}
                  </Link>
                ))}
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
            <p className="text-neutral-500">Nog geen producten in deze categorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
