import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { pageKeys, pageSlugs, resolvePageKey } from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";

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

  return {
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

  return (
    <Container className="py-10">
      <article className="font-body text-text">{key}</article>
    </Container>
  );
}
