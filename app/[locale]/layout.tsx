import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { account, articles, cart, collections, home } from "@/lib/routes";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  await params;

  return {
    alternates: {
      languages: Object.fromEntries(
        locales.map((loc) => [loc, `/${loc}`])
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <header>
          <nav>
            <a href={home(locale)}>{dictionary.nav.home}</a>
            <a href={collections(locale)}>{dictionary.nav.collections}</a>
            <a href={articles(locale)}>{dictionary.nav.articles}</a>
            <a href={cart(locale)}>{dictionary.nav.cart}</a>
            <a href={account(locale)}>{dictionary.nav.account}</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>{dictionary.footer.aboutTitle}</p>
          <p>{dictionary.footer.contactTitle}</p>
          <p>{dictionary.footer.legalTitle}</p>
          <p>{dictionary.footer.copyright}</p>
        </footer>
      </body>
    </html>
  );
}
