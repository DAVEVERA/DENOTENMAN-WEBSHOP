import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { locales, isLocale } from "@/lib/i18n";
import { getFilteredProducts, getMainCategories } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { category as categoryPath } from "@/lib/routes";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const dictionary = dictionaries[rawLocale];
  const alternates = await getAlternates(rawLocale, { type: "categories" });

  return buildStorefrontMetadata({
    title: dictionary.seo.categories.title,
    description: dictionary.seo.categories.description,
    alternates,
  });
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "categories" });
  const [products, categories] = await Promise.all([
    getFilteredProducts("all", locale, [], { limit: 300 }),
    getMainCategories(locale),
  ]);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <Container className="py-10">
        <header className="max-w-3xl">
          <h1 className="font-heading text-3xl font-bold tracking-heading text-text sm:text-4xl">
            {dictionary.seo.categories.heading}
          </h1>
          <p className="mt-3 text-body-md leading-relaxed text-muted">
            {dictionary.seo.categories.intro}
          </p>
        </header>

        <section className="mt-8" aria-labelledby="category-links-heading">
          <h2 id="category-links-heading" className="font-heading text-heading-md font-bold text-text">
            {dictionary.seo.categories.categoryLinksHeading}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={categoryPath(locale, category.slug)}
                  className="flex min-h-16 items-center justify-between rounded-card border border-border bg-surface px-5 py-4 font-heading text-heading-sm font-bold text-text shadow-card transition-colors hover:border-border-hover hover:text-accent-hover"
                >
                  <span>{category.name}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="all-products-heading">
          <h2 id="all-products-heading" className="font-heading text-heading-md font-bold text-text">
            {dictionary.seo.categories.productsHeading}
          </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((item) => (
            <ProductCard key={item.id} product={item} locale={locale} />
          ))}
        </div>
        </section>
      </Container>
    </SiteShell>
  );
}
