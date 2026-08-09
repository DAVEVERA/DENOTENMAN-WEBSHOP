import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, categories, category, home } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export async function Header({
  locale,
  dictionary,
  languages,
}: {
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const mainCategories = await getMainCategories(locale);

  return (
    <header className="border-b border-border bg-background">
      <Container className="flex items-center justify-between py-4">
        <a href={home(locale)}>
          <Logo
            alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
          />
        </a>
        <nav aria-label={dictionary.nav.categories}>
          <ul className="flex items-center gap-6">
            {mainCategories.map((item) => (
              <li key={item.id}>
                <a href={category(locale, item.slug)} className="hover:text-accent-hover">
                  {item.name}
                </a>
              </li>
            ))}
            <li>
              <a href={categories(locale)} className="hover:text-accent-hover">
                {dictionary.nav.categories}
              </a>
            </li>
            <li>
              <a href={articles(locale)} className="hover:text-accent-hover">
                {dictionary.nav.articles}
              </a>
            </li>
            <li>
              <a href={cart(locale)} className="hover:text-accent-hover">
                {dictionary.nav.cart}
              </a>
            </li>
            <li>
              <a href={account(locale)} className="hover:text-accent-hover">
                {dictionary.nav.account}
              </a>
            </li>
          </ul>
        </nav>
        <LocaleSwitcher currentLocale={locale} languages={languages} />
      </Container>
    </header>
  );
}
