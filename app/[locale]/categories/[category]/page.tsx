import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { locales, isLocale } from "@/lib/i18n";
import { getCategory, getCategorySlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { BASE_URL, categories as categoriesPath, category as categoryPath, home } from "@/lib/routes";
import { resolveFrenchCategorySlug } from "@/lib/french-category-redirects";
import { buildBreadcrumbStructuredData } from "@/lib/structured-data";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

function categoryCopy(template: string, categoryName: string): string {
  return template.replaceAll("{category}", categoryName);
}

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

  return buildStorefrontMetadata({
    title: categoryCopy(copy.title, data.name),
    description:
      data.description?.trim() || categoryCopy(copy.description, data.name),
    alternates,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  let data = await getCategory(category, locale);

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
  const breadcrumbStructuredData = buildBreadcrumbStructuredData(BASE_URL, [
    { name: copy.homeLabel, path: home(locale) },
    { name: copy.categoriesLabel, path: categoriesPath(locale) },
    { name: data.name, path: categoryPath(locale, data.slug) },
  ]);

  return (
    <Container className="py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbStructuredData).replace(/</g, "\\u003c"),
        }}
      />
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
        <nav aria-label={`${data.name} subcategorieën`} className="mt-6">
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
        {data.products.map((item) => (
          <ProductCard key={item.id} product={item} categoryName={data.name} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
