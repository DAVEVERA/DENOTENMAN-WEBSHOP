import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";
import { getCategoryNavigation } from "@/lib/queries";
import { hiddenNavCategorySlugs } from "@/lib/navVisibility";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
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
  const categories = navigation.categories.filter(
    (category) => !hiddenNavCategorySlugs.has(category.canonicalSlug)
  );

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="border-y-2 border-contrast bg-surface">
          <Container
            fullWidth
            className="grid justify-items-center gap-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-gap-md sm:py-gap-md"
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-gap-md">
              <a href={home(locale)} className="shrink-0">
                <Logo
                  alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
                  variant="light"
                  parts="wordmark"
                  size="responsive"
                />
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-gap-md">
              <div className="hidden sm:block">
                <LocaleSwitcher currentLocale={locale} languages={languages} />
              </div>
              <HeaderActions locale={locale} dictionary={dictionary} />
            </div>
          </Container>
        </div>
        <div className="hidden border-b-2 border-contrast bg-surface lg:block">
          <Container fullWidth className="relative py-3">
            <nav
              aria-label={dictionary.nav.categories}
              className="min-w-0 xl:px-14 min-[1760px]:pr-72"
            >
              <MegaMenu
                categories={categories}
                promotional={navigation.promotional}
                locale={locale}
                labels={{
                  submenu: dictionary.nav.categoryMenu,
                  viewAll: dictionary.nav.viewAllCategory,
                  overview: dictionary.nav.categoryOverview,
                }}
              />
            </nav>
            <NavbarSearch locale={locale} label={dictionary.common.search} />
          </Container>
        </div>
      </header>
      <MobileNav
        categories={categories}
        promotional={navigation.promotional}
        locale={locale}
        dictionary={dictionary}
        languages={languages}
      />
    </>
  );
}
