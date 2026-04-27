import Link from "next/link";
import { ArrowRight, Truck, ShieldCheck, Leaf } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/product/product-card";
import type { ProductCardProps } from "@/components/product/product-card";

interface CategoryTree {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  children: { id: string; slug: string; name: string; productCount: number }[];
}

interface ProductList {
  items: ProductCardProps[];
  total: number;
}

export const revalidate = 60;

export default async function HomePage() {
  let categories: CategoryTree[] = [];
  let featuredProducts: ProductList = { items: [], total: 0 };

  try {
    categories = await apiFetch<CategoryTree[]>("/categories");
    featuredProducts = await apiFetch<ProductList>("/products?pageSize=8");
  } catch {
    // API may not be running yet during first dev setup
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-green-700 via-brand-green-600 to-brand-green-800">
        <div className="absolute inset-0 bg-[url('/grain.svg')] opacity-10" />
        <div className="container-shop relative py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Leaf className="h-3.5 w-3.5" />
              Puur &amp; natuurlijk
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Premium noten
              <br />
              &amp; zuidvruchten
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/80 sm:text-xl">
              Vers verpakt, eerlijke herkomst, zonder onnodige toevoegingen. Direct bij je thuis
              bezorgd.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/categorie/noten"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-green-700 shadow-lg transition-all hover:bg-brand-green-50 hover:shadow-xl"
              >
                Bekijk assortiment
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/over-ons"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                Over ons
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-neutral-200 bg-white py-6">
        <div className="container-shop">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: Truck,
                title: "Gratis verzending",
                desc: "Vanaf €40 (NL) of €50 (BE)",
              },
              {
                icon: ShieldCheck,
                title: "Transparante herkomst",
                desc: "Wij weten waar het vandaan komt",
              },
              {
                icon: Leaf,
                title: "Zonder onnodige toevoegingen",
                desc: "Puur natuur, niets meer",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{item.title}</p>
                  <p className="text-neutral-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-16">
          <div className="container-shop">
            <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Categorieën</h2>
            <p className="mt-2 text-neutral-600">Ontdek ons uitgebreide assortiment</p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorie/${cat.slug}`}
                  className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-brand-green-200 hover:-translate-y-0.5"
                >
                  <h3 className="font-semibold text-neutral-900 group-hover:text-brand-green-700 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {cat.productCount} product{cat.productCount !== 1 ? "en" : ""}
                  </p>
                  {cat.children.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cat.children.slice(0, 3).map((child) => (
                        <span
                          key={child.id}
                          className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600"
                        >
                          {child.name}
                        </span>
                      ))}
                      {cat.children.length > 3 && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
                          +{cat.children.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      {featuredProducts.items.length > 0 && (
        <section className="bg-neutral-50 py-16">
          <div className="container-shop">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
                  Populaire producten
                </h2>
                <p className="mt-2 text-neutral-600">Onze best verkochte noten &amp; meer</p>
              </div>
              <Link
                href="/categorie/noten"
                className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-brand-green-600 transition-colors hover:text-brand-green-700"
              >
                Alles bekijken
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.items.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16">
        <div className="container-shop">
          <div className="rounded-2xl bg-brand-earth-50 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-brand-earth-800 sm:text-3xl">Heb je vragen?</h2>
            <p className="mx-auto mt-3 max-w-lg text-brand-earth-600">
              Wij helpen je graag bij het kiezen van de juiste producten. Neem gerust contact op.
            </p>
            <Link
              href="mailto:info@denotenman.nl"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-earth px-6 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-brand-earth-600 hover:shadow-md"
            >
              Neem contact op
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
