import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function ArticleDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "article", slug });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
