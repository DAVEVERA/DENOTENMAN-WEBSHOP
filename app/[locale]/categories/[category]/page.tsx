import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { locales, isLocale } from "@/lib/i18n";
import { getCategory, getCategorySlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { BASE_URL, categories as categoriesPath, category as categoryPath, home } from "@/lib/routes";
import { resolveFrenchCategorySlug } from "@/lib/french-category-redirects";
import { buildBreadcrumbStructuredData } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import { JsonLd } from "@/components/seo/JsonLd";

const dictionaries = { nl, en, fr };

function categoryCopy(template: string, categoryName: string): string {
  return template.replaceAll("{category}", categoryName);
}

// Product photos, prices and categories change in the admin while a build is
// months old. Cloud Run's ISR cache is per-instance local disk, so on-demand
// revalidatePath cannot reach every instance — a short time-based window is
// what actually bounds staleness here. Must stay a literal for Next to read it.
export const revalidate = 60;

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getCategorySlugs(locale);
      return entries.map((entry) => ({ locale, category: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const [alternates, data] = await Promise.all([
    getAlternates(rawLocale, { type: "category", slug: category }),
    getCategory(category, rawLocale),
  ]);

  if (!alternates || !data) {
    return {};
  }

  const copy = dictionaries[rawLocale].seo.category;

  return buildMetadata({
    title: categoryCopy(copy.title, data.name),
    description:
      data.description?.trim() || categoryCopy(copy.description, data.name),
    locale: rawLocale,
    alternates,
  });
}

/** Keeps the grid, and the image count on first paint, bounded. */
const PRODUCTS_PER_PAGE = 24;

/*
 * Reading `searchParams` opts this route into dynamic rendering, so the
 * `revalidate`/`generateStaticParams` prerender above no longer serves it.
 * The load balancer's `s-maxage=60` on /:locale/:path* gives shared caches
 * the same 60s freshness window, so the practical cost is a DB read per
 * cache miss rather than per request. If that proves too expensive, move
 * pagination into the path (…/categorie/noten/pagina/2) to get ISR back.
 */

function resolvePage(raw: string | string[] | undefined, totalPages: number): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);

  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return Math.min(value, totalPages);
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ locale: rawLocale, category }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const data = await getCategory(category, locale);

  if (!data && locale === "fr") {
    const correctedSlug = resolveFrenchCategorySlug(category);
    if (correctedSlug) {
      const correctedCategory = await getCategory(correctedSlug, locale);
      if (correctedCategory) {
        permanentRedirect(categoryPath(locale, correctedCategory.slug));
      }
    }
  }

  if (!data) {
    notFound();
  }

  const copy = dictionaries[locale].seo.category;
  const intro = data.description?.trim() || categoryCopy(copy.introFallback, data.name);
  const totalPages = Math.max(1, Math.ceil(data.products.length / PRODUCTS_PER_PAGE));
  const page = resolvePage(query.page, totalPages);
  const pageProducts = data.products.slice(
    (page - 1) * PRODUCTS_PER_PAGE,
    page * PRODUCTS_PER_PAGE,
  );
  const basePath = categoryPath(locale, data.slug);
  const breadcrumbStructuredData = buildBreadcrumbStructuredData(BASE_URL, [
    { name: copy.homeLabel, path: home(locale) },
    { name: copy.categoriesLabel, path: categoriesPath(locale) },
    { name: data.name, path: categoryPath(locale, data.slug) },
  ]);

  return (
    <Container className="py-10">
      <JsonLd data={breadcrumbStructuredData} />
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-body-sm text-muted">
        <Link href={home(locale)} className="inline-flex min-h-11 items-center hover:text-text hover:underline">
          {copy.homeLabel}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={categoriesPath(locale)} className="inline-flex min-h-11 items-center hover:text-text hover:underline">
          {copy.categoriesLabel}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.name}</span>
      </nav>
      <h1 className="font-heading text-3xl tracking-heading text-text">{data.name}</h1>
      <p className="mt-3 max-w-3xl text-body-md leading-relaxed text-muted">{intro}</p>
      {data.children.length > 0 ? (
        <nav aria-label={`${copy.categoriesLabel}: ${data.name}`} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {data.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={categoryPath(locale, child.slug)}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 py-2 font-heading text-body-sm font-bold text-text transition-colors duration-hover-fast hover:border-accent hover:bg-accent/10 hover:text-accent-hover"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {pageProducts.map((item) => (
          <ProductCard key={item.id} product={item} categoryName={data.name} locale={locale} />
        ))}
      </div>
      {totalPages > 1 ? (
        <nav
          aria-label={copy.paginationLabel}
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
            const isCurrent = pageNumber === page;
            // Page 1 keeps the bare category URL so it stays the one address
            // for the collection, matching the canonical.
            const href = pageNumber === 1 ? basePath : `${basePath}?page=${pageNumber}`;

            return isCurrent ? (
              <span
                key={pageNumber}
                aria-current="page"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-accent bg-accent/10 px-4 font-heading text-body-sm font-bold text-accent-hover"
              >
                {pageNumber}
              </span>
            ) : (
              <Link
                key={pageNumber}
                href={href}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text transition-colors duration-hover-fast hover:border-accent hover:bg-accent/10 hover:text-accent-hover"
              >
                {pageNumber}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </Container>
  );
}
