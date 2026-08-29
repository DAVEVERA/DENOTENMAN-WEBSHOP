import type { ReactNode } from "react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export function SiteShell({
  className,
  locale,
  dictionary,
  languages,
  children,
}: {
  className?: string;
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
  children: ReactNode;
}) {
  const shell = (
    <>
      <Header locale={locale} dictionary={dictionary} languages={languages} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} dictionary={dictionary} />
    </>
  );

  return className ? <div className={className}>{shell}</div> : shell;
}
