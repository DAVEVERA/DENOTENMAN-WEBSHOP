import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { getCategoryNavigation } from "@/lib/queries";
import { CompactHeader } from "@/components/layout/CompactHeader";

export async function Header({
  locale,
  dictionary,
  languages,
}: {
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const navigation = await getCategoryNavigation(locale);

  return (
    <CompactHeader
      categories={navigation.categories}
      promotional={navigation.promotional}
      locale={locale}
      dictionary={dictionary}
      languages={languages}
    />
  );
}
