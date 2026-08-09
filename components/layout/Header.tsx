import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, home } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { Search, User, ShoppingCart } from "lucide-react";

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex items-center justify-between gap-gap-md py-gap-md">
        <div className="flex items-center gap-gap-lg">
          <MobileNav categories={mainCategories} locale={locale} dictionary={dictionary} />
          <a href={home(locale)}>
            <Logo
              alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
              variant="light"
              parts="full"
              size="lg"
            />
          </a>
        </div>
        <nav aria-label={dictionary.nav.categories} className="hidden lg:flex lg:items-center lg:gap-gap-lg">
          <MegaMenu categories={mainCategories} locale={locale} label={dictionary.nav.categories} />
          <a href={articles(locale)} className="font-heading text-body-md text-text hover:text-accent-hover">
            {dictionary.nav.articles}
          </a>
        </nav>
        <div className="flex items-center gap-gap-md">
          <button type="button" aria-label={dictionary.nav.search} className="text-text hover:text-accent-hover">
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <a href={account(locale)} aria-label={dictionary.common.account} className="text-text hover:text-accent-hover">
            <User className="h-5 w-5" aria-hidden="true" />
          </a>
          <a href={cart(locale)} aria-label={dictionary.common.cart} className="text-text hover:text-accent-hover">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          </a>
          <LocaleSwitcher currentLocale={locale} languages={languages} />
        </div>
      </Container>
    </header>
  );
}
