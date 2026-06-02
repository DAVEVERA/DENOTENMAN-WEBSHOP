import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { serverApiClient } from "@/lib/server-api";
import type { Product, CategoryDetail } from "@denotenman/schemas";

interface Props {
  params: { slug: string };
  searchParams: { page?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const api = serverApiClient();
    const cat = await api.categories.getBySlug(params.slug);
    return {
      title: cat.name,
      description: cat.description ?? `Ontdek ${cat.name} bij DeNotenman`,
    };
  } catch {
    return { title: "Categorie" };
  }
}

export const revalidate = 60;

export default async function CategoryPage({ params, searchParams }: Props) {
  const page = Number(searchParams.page ?? "1");

  const api = serverApiClient();
  const [category, products] = await Promise.all([
    api.categories.getBySlug(params.slug).catch((): CategoryDetail | null => null),
    api.products.list({ category: params.slug, page, pageSize: 12 }).catch(() => null),
  ]);

  if (!category || !products) {
    notFound();
  }

  const totalPages = Math.ceil(products.total / products.pageSize);
  const typedItems: Product[] = products.items;

  return (
    <div className="bg-surface min-h-screen pb-24">
      {/* Category Hero */}
      <div className="bg-brand-primary text-white py-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(var(--brand-gold) 2px, transparent 2px)`,
            backgroundSize: "30px 30px",
          }}
        ></div>
        <div className="container-shop relative z-10">
          <nav
            aria-label="Kruimelpad"
            className="mb-6 inline-block bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-brand-gold/30"
          >
            <ol className="flex items-center gap-2 text-sm text-brand-gold font-medium">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <ChevronRight className="h-4 w-4" />
              {category.parent && (
                <>
                  <li>
                    <Link
                      href={`/categorie/${category.parent.slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {category.parent.name}
                    </Link>
                  </li>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
              <li className="text-white">{category.name}</li>
            </ol>
          </nav>

          <h1 className="text-4xl md:text-5xl font-bold text-brand-gold mb-4 drop-shadow-md">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-lg text-surface/90 max-w-3xl leading-relaxed">
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="container-shop mt-12">
        {category.children.length > 0 && (
          <div className="mb-12 flex flex-wrap gap-3">
            {category.children.map((c) => (
              <Link
                key={c.id}
                href={`/categorie/${c.slug}`}
                className="rounded-xl border border-brand-gold/30 bg-white px-6 py-3 text-sm font-bold text-brand-primary shadow-sm hover:border-brand-highlight hover:bg-brand-primary hover:text-brand-gold hover:-translate-y-1 transition-all"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {typedItems.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-8">
              <p className="text-base font-medium text-brand-primary/70">
                {products.total} ambachtelijke producten
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {typedItems.map((p) => (
                <ProductCard key={p.id} {...(p as any)} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Paginering" className="mt-16 flex justify-center gap-3">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/categorie/${params.slug}?page=${p}`}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold shadow-sm transition-all hover:-translate-y-1 ${p === products.page ? "bg-brand-primary text-brand-gold border-brand-primary" : "bg-white text-brand-primary border border-brand-gold/30 hover:bg-brand-gold/10"}`}
                    aria-current={p === products.page ? "page" : undefined}
                  >
                    {p}
                  </Link>
                ))}
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-brand-gold/20 bg-white py-24 text-center shadow-lg">
            <p className="text-xl text-brand-primary/60 font-medium">
              Nog geen producten in deze categorie.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
