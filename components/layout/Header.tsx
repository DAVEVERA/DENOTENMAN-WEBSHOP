import type nl from "@/dictionaries/nl.json";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";
import { getCategoryNavigation } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { NavbarSearch } from "@/components/layout/NavbarSearch";

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
  const categories = navigation.categories;

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="border-y-2 border-contrast bg-surface">
        <Container fullWidth>
          <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:hidden">
            <MobileNav
              categories={categories}
              promotional={navigation.promotional}
              locale={locale}
              dictionary={dictionary}
              languages={languages}
            />
          </div>
          <div className="hidden w-full grid-cols-[minmax(12.5rem,15.25rem)_minmax(17.5rem,1fr)_auto] items-center gap-6 py-4 xl:grid">
            <div className="min-w-0">
              <Link href={home(locale)} className="shrink-0">
                <Logo
                  alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
                  variant="light"
                  parts="wordmark"
                  size="responsive"
                />
              </Link>
            </div>
            <NavbarSearch
              locale={locale}
              label={dictionary.common.search}
              placeholder={dictionary.nav.searchPlaceholder}
            />
            <HeaderActions
              locale={locale}
              dictionary={dictionary}
              languages={languages}
            />
          </div>
        </Container>
      </div>
      <div className="hidden border-b-2 border-contrast bg-surface xl:block">
        <Container fullWidth className="py-3">
          <nav aria-label={dictionary.nav.categories} className="min-w-0">
            <MegaMenu
              categories={categories}
              promotional={navigation.promotional}
              locale={locale}
              labels={{
                submenu: dictionary.nav.categoryMenu,
                viewAll: dictionary.nav.viewAllCategory,
              }}
            />
          </nav>
        </Container>
      </div>
    </header>
  );
}
