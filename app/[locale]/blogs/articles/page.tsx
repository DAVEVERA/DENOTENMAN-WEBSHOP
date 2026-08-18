import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { getArticles } from "@/lib/queries";
import { article as articlePath, categories as categoriesPath } from "@/lib/routes";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

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
  const [alternates, articles] = await Promise.all([
    getAlternates(rawLocale, { type: "articles" }),
    getArticles(rawLocale),
  ]);

  return buildStorefrontMetadata({
    title: dictionary.seo.articles.title,
    description: dictionary.seo.articles.description,
    alternates,
    noIndex: articles.length === 0,
  });
}

export default async function ArticlesPage({
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
  const alternates = await getAlternates(locale, { type: "articles" });
  const articles = await getArticles(locale);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <Container className="py-10">
        <header className="max-w-3xl">
          <h1 className="font-heading text-3xl font-bold tracking-heading text-text sm:text-4xl">
            {dictionary.seo.articles.heading}
          </h1>
          <p className="mt-3 text-body-md leading-relaxed text-muted">
            {dictionary.seo.articles.intro}
          </p>
        </header>

        {articles.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.id}>
                <article className="flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card">
                  <h2 className="font-heading text-heading-md font-bold text-text">{article.title}</h2>
                  <Link
                    href={articlePath(locale, article.slug)}
                    className="mt-5 inline-flex min-h-11 items-center font-heading text-body-sm font-bold text-accent-hover underline decoration-border-hover underline-offset-4 hover:text-accent"
                  >
                    {dictionary.seo.articles.readArticle}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <section className="mt-8 max-w-2xl rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="font-heading text-heading-md font-bold text-text">
              {dictionary.seo.articles.emptyTitle}
            </h2>
            <p className="mt-2 text-body-md leading-relaxed text-muted">
              {dictionary.seo.articles.emptyDescription}
            </p>
            <Link
              href={categoriesPath(locale)}
              className="mt-5 inline-flex min-h-11 items-center rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast hover:bg-accent-hover"
            >
              {dictionary.seo.articles.emptyCta}
            </Link>
          </section>
        )}
      </Container>
    </SiteShell>
  );
}
