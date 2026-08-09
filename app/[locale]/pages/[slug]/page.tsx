import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { pageKeys, pagePath, pageSlugs, resolvePageKey } from "@/lib/pages";

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

  return {
    alternates: {
      canonical: pagePath(key, locale),
      languages: Object.fromEntries(locales.map((loc) => [loc, pagePath(key, loc)])),
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

  return <article>{key}</article>;
}
