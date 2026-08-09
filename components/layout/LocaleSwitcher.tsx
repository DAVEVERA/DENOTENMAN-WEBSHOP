"use client";

import { locales, type Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({
  currentLocale,
  languages,
}: {
  currentLocale: Locale;
  languages: Partial<Record<Locale, string>>;
}) {
  return (
    <ul className="flex items-center gap-gap-sm text-body-sm">
      {locales.map((locale) => {
        const href = languages[locale] ?? home(locale);

        return (
          <li key={locale}>
            <a
              href={href}
              aria-current={locale === currentLocale ? "true" : undefined}
              className={cn(
                "uppercase text-muted transition-colors duration-hover-fast hover:text-text",
                locale === currentLocale && "font-semibold text-text"
              )}
            >
              {locale}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
