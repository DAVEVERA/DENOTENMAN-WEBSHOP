import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { articles, home } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { groupMainCategories } from "@/lib/categoryGroups";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderActions } from "@/components/layout/HeaderActions";

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
  const { groups, promotional } = groupMainCategories(mainCategories);

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="border-y-2 border-contrast bg-surface">
          <Container
            fullWidth
            className="flex flex-wrap items-center justify-between gap-gap-md py-3 sm:py-gap-md"
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
              <p className="hidden min-w-0 text-body-sm text-muted sm:block">
                {dictionary.brand.baseline}
              </p>
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
          <Container fullWidth className="py-3">
            <nav
              aria-label={dictionary.nav.categories}
              className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
            >
              <MegaMenu groups={groups} promotional={promotional} locale={locale} />
              <a
                href={articles(locale)}
                className="font-heading text-body-md font-bold text-text transition-colors duration-hover-fast hover:text-accent-hover"
              >
                {dictionary.nav.articles}
              </a>
            </nav>
          </Container>
        </div>
      </header>
      <MobileNav
        categories={mainCategories}
        locale={locale}
        dictionary={dictionary}
        languages={languages}
      />
    </>
  );
}
