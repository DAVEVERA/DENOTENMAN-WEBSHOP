import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { pageKeys, pageRobots, pageSlugs, resolvePageKey } from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { getPageBySlug } from "@/lib/queries";
import { Terms } from "./_components/Terms";
import { Privacy } from "./_components/Privacy";
import { ShippingReturns } from "./_components/ShippingReturns";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    pageKeys.map((key) => ({ locale, slug: pageSlugs[key][locale] }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    return {};
  }

  const alternates = await getAlternates(locale, { type: "page", key });

  if (!alternates) {
    return {};
  }

  const page = await getPageBySlug(slug, locale);
  const title = page?.title || key.charAt(0).toUpperCase() + key.slice(1);

  return {
    title,
    robots: pageRobots(key),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    notFound();
  }

  // 1. Render custom high-quality statically-styled Dutch components
  if (locale === "nl") {
    if (key === "terms") {
      return (
        <Container className="py-12">
          <Terms locale={locale} />
        </Container>
      );
    }
    if (key === "privacy") {
      return (
        <Container className="py-12">
          <Privacy locale={locale} />
        </Container>
      );
    }
    if (key === "shippingReturns") {
      return (
        <Container className="py-12">
          <ShippingReturns locale={locale} />
        </Container>
      );
    }
  }

  // 2. Fetch page translation dynamically from the database
  const page = await getPageBySlug(slug, locale);

  if (page && page.body) {
    return (
      <Container className="py-12">
        <article className="prose max-w-4xl mx-auto text-text">
          <h1 className="text-4xl font-bold text-contrast mb-8">{page.title}</h1>
          <div className="leading-relaxed whitespace-pre-wrap">{page.body}</div>
        </article>
      </Container>
    );
  }

  // 3. Render elegant placeholder if page translation is empty or does not exist
  return (
    <Container className="py-12">
      <article className="prose max-w-4xl mx-auto text-text text-center py-20">
        <h1 className="text-3xl font-bold text-contrast mb-4">
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </h1>
        <p className="text-muted">
          Deze pagina is momenteel nog niet gevuld. Kom snel terug voor meer informatie!
        </p>
      </article>
    </Container>
  );
}
