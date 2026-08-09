import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

export function Footer({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  return (
    <footer className="bg-contrast text-background">
      <Container className="flex flex-col gap-6 py-10">
        <span className="inline-block w-fit rounded bg-surface p-4">
          <Logo
            alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
            variant="dark"
            parts="wordmark"
          />
        </span>
        <nav aria-label={dictionary.footer.legalTitle}>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li>
              <a href={pagePath("terms", locale)}>{dictionary.footer.terms}</a>
            </li>
            <li>
              <a href={pagePath("privacy", locale)}>{dictionary.footer.privacy}</a>
            </li>
            <li>
              <a href={pagePath("cookies", locale)}>{dictionary.footer.cookies}</a>
            </li>
            <li>
              <a href={pagePath("withdrawal", locale)}>{dictionary.footer.withdrawal}</a>
            </li>
            <li>
              <a href={pagePath("contact", locale)}>{dictionary.footer.contact}</a>
            </li>
            <li>
              <a href={pagePath("subscribe", locale)}>{dictionary.footer.subscribe}</a>
            </li>
            <li>
              <a href={pagePath("optOut", locale)}>{dictionary.footer.optOut}</a>
            </li>
          </ul>
        </nav>
        <p className="text-sm text-background/70">{dictionary.footer.copyright}</p>
      </Container>
    </footer>
  );
}
