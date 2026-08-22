"use client";

import { locales, type Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";

const flagSource: Record<Locale, string> = {
  nl: "/flags/nl.webp",
  en: "/flags/en.webp",
  fr: "/flags/fr.webp",
};

const languageName: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  fr: "Français",
};

const menuLabel: Record<Locale, string> = {
  nl: "Taal",
  en: "Language",
  fr: "Langue",
};

export function LocaleSwitcher({
  currentLocale,
  languages,
}: {
  currentLocale: Locale;
  languages: Partial<Record<Locale, string>>;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={`${menuLabel[currentLocale]}: ${languageName[currentLocale]}`}
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-button px-1 transition-colors duration-hover-fast hover:bg-background [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="h-8 w-10 rounded-[0.6rem] bg-cover bg-center bg-no-repeat shadow-card"
          style={{ backgroundImage: `url("${flagSource[currentLocale]}")` }}
        />
      </summary>
      <ul className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-44 overflow-hidden rounded-card border border-border bg-surface p-1 shadow-card-hover">
        {locales.map((locale) => {
          const href = languages[locale] ?? home(locale);

          return (
            <li key={locale}>
              <a
                href={href}
                hrefLang={locale}
                aria-current={locale === currentLocale ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-button px-3 py-2 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:bg-background"
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-8 shrink-0 rounded-md bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url("${flagSource[locale]}")` }}
                />
                {languageName[locale]}
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
