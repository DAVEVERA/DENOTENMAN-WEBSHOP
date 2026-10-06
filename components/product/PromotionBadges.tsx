import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n";
import { countdownText, type BadgeView } from "@/lib/promotions/engine";

type Placement = "card" | "detail";

const SIZE: Record<BadgeView["size"], string> = {
  sm: "px-2 py-0.5 text-[0.625rem] sm:text-[0.6875rem]",
  md: "px-2 py-0.5 text-[0.6875rem] sm:px-2.5 sm:py-1 sm:text-xs",
  lg: "px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm",
};

const CIRCLE: Record<BadgeView["size"], string> = {
  sm: "h-11 w-11 text-[0.5625rem] sm:h-12 sm:w-12",
  md: "h-12 w-12 text-[0.625rem] sm:h-14 sm:w-14 sm:text-[0.6875rem]",
  lg: "h-14 w-14 text-[0.6875rem] sm:h-16 sm:w-16 sm:text-xs",
};

const SHAPE: Record<BadgeView["shape"], string> = {
  pill: "rounded-full",
  rounded: "rounded-md",
  square: "rounded-none",
  // A flag with a notch on the right; extra right padding keeps text clear of the notch.
  ribbon: "rounded-l-sm pr-4 [clip-path:polygon(0_0,100%_0,calc(100%-0.5rem)_50%,100%_100%,0_100%)]",
  circle: "rounded-full",
};

const CORNER: Record<BadgeView["position"], string> = {
  "top-left": "left-0 top-0 items-start",
  "top-right": "right-0 top-0 items-end",
  "bottom-left": "bottom-0 left-0 items-start",
  "bottom-right": "bottom-0 right-0 items-end",
};

function Badge({ badge, locale }: { badge: BadgeView; locale: Locale }) {
  const countdown = badge.countdownEndsAt ? countdownText(badge.countdownEndsAt, new Date(), locale) : null;
  const style: CSSProperties = { backgroundColor: badge.background, color: badge.color };
  const percent = badge.percentOff ? `−${badge.percentOff}%` : null;
  if (badge.shape === "circle") {
    return (
      <span style={style} className={cn("inline-flex flex-col items-center justify-center p-1 text-center font-heading font-bold leading-tight shadow-card", CIRCLE[badge.size], SHAPE.circle)}>
        <span className="line-clamp-2">{badge.text}</span>
        {percent ? <span>{percent}</span> : null}
      </span>
    );
  }
  return (
    <span style={style} className={cn("inline-flex max-w-full flex-col font-heading font-bold leading-tight tracking-heading shadow-card", SIZE[badge.size], SHAPE[badge.shape])}>
      <span className="truncate">{badge.text}{percent ? <span className="ml-1 whitespace-nowrap">{percent}</span> : null}</span>
      {countdown ? <span className="truncate text-[0.85em] font-semibold opacity-90" suppressHydrationWarning>{countdown}</span> : null}
    </span>
  );
}

/**
 * Promotion labels. On cards they float in the corners of the image square, outside
 * the round product photo; on detail views they sit inline above the price.
 */
export function PromotionBadges({
  badges,
  placement,
  locale,
  className,
}: {
  badges: BadgeView[] | null | undefined;
  placement: Placement;
  locale: Locale;
  className?: string;
}) {
  const visible = (badges ?? []).filter((badge) => badge.placements[placement]);
  if (!visible.length) return null;

  if (placement === "detail") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {visible.map((badge) => <Badge key={badge.id} badge={badge} locale={locale} />)}
      </div>
    );
  }

  const byPosition = new Map<BadgeView["position"], BadgeView[]>();
  for (const badge of visible) byPosition.set(badge.position, [...(byPosition.get(badge.position) ?? []), badge]);
  return (
    <>
      {[...byPosition.entries()].map(([position, group]) => (
        <span key={position} className={cn("pointer-events-none absolute z-10 flex max-w-[78%] flex-col gap-1", CORNER[position], className)}>
          {group.map((badge) => <Badge key={badge.id} badge={badge} locale={locale} />)}
        </span>
      ))}
    </>
  );
}

const TIER_COPY: Record<Locale, { title: string; line: (quantity: number, percent: number) => string; product: string; mix: string }> = {
  nl: { title: "Stapelkorting", line: (q, p) => `Vanaf ${q} stuks ${p}% korting`, product: "Alle varianten van dit product tellen samen.", mix: "Combineer met andere producten uit deze actie." },
  en: { title: "Volume discount", line: (q, p) => `${p}% off from ${q} items`, product: "All variants of this product count together.", mix: "Mix with other products in this promotion." },
  fr: { title: "Remise par quantité", line: (q, p) => `${p} % de remise dès ${q} pièces`, product: "Toutes les variantes de ce produit comptent ensemble.", mix: "Combinez avec d’autres produits de cette promotion." },
};

/** The volume tiers of a product, shown above the order buttons. */
export function VolumeTierNotice({
  tiers,
  locale,
  className = "mt-5",
}: {
  tiers: Array<{ minQuantity: number; percentOff: number; scope: "LINE" | "PRODUCT" | "PROMOTION" }> | null | undefined;
  locale: Locale;
  className?: string;
}) {
  if (!tiers?.length) return null;
  const copy = TIER_COPY[locale];
  const scope = tiers[0].scope;
  return (
    <section className={cn("rounded-card border border-accent bg-accent/10 p-4", className)} aria-label={copy.title}>
      <p className="font-heading text-body-sm font-bold text-text">{copy.title}</p>
      <ul className="mt-2 grid gap-1 text-body-sm text-text">
        {tiers.map((tier) => (
          <li key={tier.minQuantity} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-ink" />
            {copy.line(tier.minQuantity, tier.percentOff)}
          </li>
        ))}
      </ul>
      {scope !== "LINE" ? <p className="mt-2 text-xs text-muted">{scope === "PRODUCT" ? copy.product : copy.mix}</p> : null}
    </section>
  );
}
