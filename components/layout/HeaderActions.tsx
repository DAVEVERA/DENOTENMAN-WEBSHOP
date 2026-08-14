"use client";

import { Heart, MessageCircle, ShoppingCart } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account as accountPath, cart as cartPath } from "@/lib/routes";
import { pagePath } from "@/lib/pages";
import { useStorefrontState } from "@/lib/storefront-state";

const iconButtonClass =
  "relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-text shadow-card transition-colors duration-hover-fast hover:border-border-hover hover:text-accent-hover";

const whatsappNumber = "31411700232";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.51 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.34-.5.05-1.06.07-1.72-.11-.4-.11-.9-.28-1.55-.55-2.73-1.18-4.52-3.95-4.65-4.13-.13-.18-1.1-1.46-1.1-2.79s.7-1.98.95-2.25c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.16.01.38-.06.6.46.24.57.8 1.98.88 2.12.07.15.12.32.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.27.71 1.17 1.53 1.89 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.26.13.43.19.5.3.07.11.07.63-.17 1.31Z" />
    </svg>
  );
}

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
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  const { favorites, cart } = useStorefrontState();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <a href={pagePath("contact", locale)} aria-label={dictionary.nav.contact} className={iconButtonClass}>
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </a>
      <a
        href={`https://wa.me/${whatsappNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={dictionary.nav.whatsapp}
        className={iconButtonClass}
      >
        <WhatsAppIcon />
      </a>
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
