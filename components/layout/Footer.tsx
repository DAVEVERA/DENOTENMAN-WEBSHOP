import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { category as categoryPath } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

export async function Footer({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  const mainCategories = await getMainCategories(locale);

  return (
    <footer className="bg-contrast text-background">
      <Container className="grid grid-cols-1 gap-gap-lg py-panel sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-gap-md">
          <span className="inline-block w-fit rounded bg-surface p-gap-sm">
            <Logo
              alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
              variant="dark"
              parts="wordmark"
            />
          </span>
          <p className="text-body-sm text-background/70">{dictionary.brand.baseline}</p>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.categoriesTitle}</h2>
          <ul className="mt-gap-md flex flex-col gap-gap-sm text-body-sm">
            {mainCategories.map((item) => (
              <li key={item.id}>
                <a href={categoryPath(locale, item.slug)} className="text-background/80 hover:text-background">
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.serviceTitle}</h2>
          <nav aria-label={dictionary.footer.legalTitle}>
            <ul className="mt-gap-md flex flex-col gap-gap-sm text-body-sm">
              <li>
                <a href={pagePath("terms", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.terms}
                </a>
              </li>
              <li>
                <a href={pagePath("privacy", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.privacy}
                </a>
              </li>
              <li>
                <a href={pagePath("cookies", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.cookies}
                </a>
              </li>
              <li>
                <a href={pagePath("withdrawal", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.withdrawal}
                </a>
              </li>
              <li>
                <a href={pagePath("subscribe", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.subscribe}
                </a>
              </li>
              <li>
                <a href={pagePath("optOut", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.optOut}
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.contactTitleColumn}</h2>
          <a
            href={pagePath("contact", locale)}
            className="mt-gap-md block text-body-sm text-background/80 hover:text-background"
          >
            {dictionary.footer.contact}
          </a>
          <h3 className="mt-gap-lg font-heading text-body-md text-background">{dictionary.footer.marketDaysTitle}</h3>
          <ul className="mt-gap-sm flex flex-col gap-gap-sm text-body-sm text-background/80">
            <li>{dictionary.footer.marketDayThursday}</li>
            <li>{dictionary.footer.marketDayFriday}</li>
            <li>{dictionary.footer.marketDaySaturday}</li>
          </ul>
        </div>
      </Container>
      <Container className="border-t border-background/10 py-gap-md">
        <p className="text-body-sm text-background/70">{dictionary.footer.copyright}</p>
      </Container>
    </footer>
  );
}
