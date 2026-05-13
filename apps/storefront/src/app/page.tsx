import Link from "next/link";
import { ArrowRight, Truck, ShieldCheck, Leaf } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { serverApiClient } from "@/lib/server-api";
import type { Product, CategoryTree } from "@denotenman/schemas";
import Image from "next/image";

export const revalidate = 60;

export default async function HomePage() {
  let categories: CategoryTree[] = [];
  let featuredProducts: Product[] = [];
  let total = 0;

  try {
    const api = serverApiClient();
    [categories, { items: featuredProducts, total }] = await Promise.all([
      api.categories.list(),
      api.products.list({ pageSize: 12 }),
    ]);
  } catch {
    // API may not be running yet during first dev setup
  }

  const activeCategories = categories.filter((c) => c.productCount > 0);
  const visibleProducts = featuredProducts.filter((p) => p.images.length > 0);

  void total;

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-primary">
        <div className="absolute inset-0">
          <Image
            src="/Hero/hero2.png"
            alt="De Notenman assortiment"
            fill
            className="object-cover object-center opacity-40 mix-blend-overlay"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary to-transparent opacity-80" />

        <div className="container-shop relative py-24 sm:py-32 lg:py-40 z-10">
          <div className="max-w-3xl flex flex-col items-start">
            <Image
              src="/Logo/DeNotenmanH1Logo.png"
              alt="De Notenman Logo"
              width={250}
              height={80}
              className="mb-8 invert drop-shadow-md object-contain"
              style={{ width: "auto", height: "auto" }}
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/50 bg-brand-primary/50 px-4 py-1.5 text-xs font-semibold text-brand-gold backdrop-blur-md">
              <Leaf className="h-3.5 w-3.5" />
              Puur &amp; natuurlijk
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-7xl drop-shadow-lg">
              Premium noten <br />
              <span className="text-brand-gold">&amp; zuidvruchten</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-surface/90 sm:text-xl drop-shadow max-w-2xl">
              Vers verpakt, eerlijke herkomst, zonder onnodige toevoegingen. Direct bij je thuis
              bezorgd met de kwaliteit van de markt.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/categorie/noten"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-8 py-4 text-base font-bold text-brand-primary shadow-xl shadow-brand-primary/20 transition-all hover:bg-white hover:scale-105"
              >
                Bekijk assortiment
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/over-ons"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-brand-gold px-8 py-4 text-base font-bold text-brand-gold backdrop-blur-sm transition-all hover:bg-brand-gold hover:text-brand-primary"
              >
                Over ons
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-brand-gold/20 bg-surface py-8">
        <div className="container-shop">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
                title: "Zonder toevoegingen",
                desc: "Puur natuur, niets meer",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-4 text-sm group">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-brand-gold shadow-md transition-transform group-hover:scale-110">
                  <item.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-brand-primary text-base">{item.title}</p>
                  <p className="text-brand-primary/70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bowl product gallery */}
      {visibleProducts.length > 0 && (
        <section className="py-20 bg-white relative">
          <div className="container-shop relative z-10">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-3xl font-bold text-brand-primary sm:text-4xl relative inline-block">
                  Ons assortiment
                  <div className="absolute -bottom-2 left-0 h-1 w-1/3 bg-brand-highlight rounded-full"></div>
                </h2>
                <p className="mt-4 text-brand-primary/60 text-lg">Vers verpakt, elke dag</p>
              </div>
              <Link
                href="/categorie/noten"
                className="hidden sm:inline-flex items-center gap-2 text-base font-bold text-brand-gold hover:text-brand-highlight transition-colors"
              >
                Alles bekijken
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>

            <div className="mt-12 text-center sm:hidden">
              <Link
                href="/categorie/noten"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-gold px-8 py-3.5 text-base font-bold text-brand-primary hover:bg-brand-gold transition-colors"
              >
                Alles bekijken <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      {activeCategories.length > 0 && (
        <section className="py-20 bg-surface relative overflow-hidden">
          {/* Subtle Background Pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(var(--brand-pattern) 2px, transparent 2px)`,
              backgroundSize: "30px 30px",
            }}
          ></div>

          <div className="container-shop relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-brand-primary sm:text-4xl">Categorieën</h2>
              <p className="mt-4 text-brand-primary/70 text-lg">
                Ontdek ons uitgebreide assortiment
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {activeCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorie/${cat.slug}`}
                  className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-white p-8 text-center shadow-md transition-all hover:-translate-y-1 hover:shadow-xl border border-brand-gold/20"
                >
                  <div className="absolute inset-0 bg-brand-primary opacity-0 transition-opacity group-hover:opacity-5"></div>
                  <h3 className="relative z-10 text-xl font-bold text-brand-primary transition-colors">
                    {cat.name}
                  </h3>
                  <p className="relative z-10 mt-2 text-sm font-medium text-brand-gold">
                    {cat.productCount} product{cat.productCount !== 1 ? "en" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-24 bg-brand-primary relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('/Branding/Lookenfeel.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>

        <div className="container-shop relative z-10">
          <div className="mx-auto max-w-3xl rounded-3xl border border-brand-gold/30 bg-brand-primary/80 p-10 text-center backdrop-blur-md sm:p-16 shadow-2xl">
            <Image
              src="/Logo/Denotenmascotte.png"
              alt="Mascotte"
              width={100}
              height={100}
              className="mx-auto mb-6 object-contain drop-shadow-md"
            />
            <h2 className="text-3xl font-bold text-brand-gold sm:text-4xl">
              Heb je vragen of specifieke wensen?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-surface/90">
              Wij helpen je graag bij het kiezen van de juiste producten voor jouw behoeften. Neem
              gerust contact met ons op voor advies op maat.
            </p>
            <Link
              href="mailto:info@denotenman.com"
              className="mt-10 inline-flex items-center gap-2 rounded-xl bg-brand-highlight px-8 py-4 text-lg font-bold text-brand-primary shadow-lg transition-all hover:bg-white hover:scale-105"
            >
              Neem contact op
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
