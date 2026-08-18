import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { getArticleBySlug } from "@/lib/queries";
import { sanitizeProductHtml, toProductPlainText } from "@/lib/product-content";
import { Container } from "@/components/ui/Container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const [alternates, article] = await Promise.all([
    getAlternates(locale, { type: "article", slug }),
    getArticleBySlug(slug, locale),
  ]);

  if (!alternates || !article) {
    return {};
  }

  const description = toProductPlainText(article.body).slice(0, 160) || undefined;

  return {
    title: article.title,
    description,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const article = await getArticleBySlug(slug, locale);
  if (!article) {
    notFound();
  }

  const safeBody = sanitizeProductHtml(article.body);

  return (
    <Container className="py-10">
      <article className="mx-auto max-w-3xl font-body text-text">
        <h1 className="font-heading text-3xl font-bold tracking-heading sm:text-4xl">
          {article.title}
        </h1>
        {safeBody ? (
          <div
            className="product-rich-text mt-6"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        ) : null}
      </article>
    </Container>
  );
}
