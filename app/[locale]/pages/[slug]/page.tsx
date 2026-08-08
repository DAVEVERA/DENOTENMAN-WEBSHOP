import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { pageKeys, pagePath, pageSlugs, resolvePageKey } from "@/lib/pages";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    pageKeys.map((key) => ({ locale, slug: pageSlugs[key][locale] }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
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
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    notFound();
  }

  return <article>{key}</article>;
}
