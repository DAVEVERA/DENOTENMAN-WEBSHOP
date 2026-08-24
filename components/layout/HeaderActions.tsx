"use client";

import { Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account as accountPath, cart as cartPath } from "@/lib/routes";
import { pagePath } from "@/lib/pages";
import { useStorefrontState } from "@/lib/storefront-state";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

const iconButtonClass =
  "relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-text shadow-card transition-colors duration-hover-fast hover:border-border-hover hover:text-accent-hover";

const utilityLinkClass =
  "inline-flex min-h-11 items-center whitespace-nowrap px-1 font-heading text-body-sm font-semibold text-text underline decoration-border-hover underline-offset-4 transition-colors duration-hover-fast hover:text-accent-hover";

function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-contrast"
    >
      {count}
    </span>
  );
}

export function HeaderActions({
  locale,
  dictionary,
  languages,
}: {
  locale: Locale;
  dictionary: typeof nl;
  languages?: Partial<Record<Locale, string>>;
}) {
  const { favorites, cart } = useStorefrontState();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex shrink-0 items-center gap-3 xl:gap-4">
      <a
        href={pagePath("contact", locale)}
        className={utilityLinkClass}
      >
        {dictionary.nav.business}
      </a>
      <Link
        href={pagePath("faq", locale)}
        className={utilityLinkClass}
      >
        {dictionary.nav.customerService}
      </Link>
      <a
        href={pagePath("markets", locale)}
        className={utilityLinkClass}
      >
        {dictionary.nav.whereIsNotenman}
      </a>
      {languages ? (
        <LocaleSwitcher currentLocale={locale} languages={languages} />
      ) : null}
      <a
        href={`${accountPath(locale)}#favorites-title`}
        aria-label={dictionary.nav.favoritesWithCount.replace("{count}", String(favorites.length))}
        className={iconButtonClass}
      >
        <Heart className="h-5 w-5" aria-hidden="true" />
        <CountBadge count={favorites.length} />
      </a>
      <a
        href={cartPath(locale)}
        aria-label={dictionary.nav.cartWithCount.replace("{count}", String(cartCount))}
        className={iconButtonClass}
      >
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        <CountBadge count={cartCount} />
      </a>
    </div>
  );
}
