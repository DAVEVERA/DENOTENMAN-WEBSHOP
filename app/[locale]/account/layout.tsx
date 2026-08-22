import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
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
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    title: `${dictionaries[locale].account.title} | De Notenman`,
    robots: { index: false, follow: false },
  };
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "account" });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
