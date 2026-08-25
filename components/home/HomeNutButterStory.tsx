import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type HomeNutButterStoryProps = {
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  highlights: string[];
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HomeNutButterStory({
  eyebrow,
  title,
  body,
  detail,
  highlights,
  imageAlt,
  ctaLabel,
  ctaHref,
}: HomeNutButterStoryProps) {
  return (
    <section
      className="overflow-hidden bg-[linear-gradient(180deg,#f8f5ef_0%,#efe8dc_7rem,#efe8dc_100%)]"
      aria-labelledby="home-nut-butter-title"
    >
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-stretch">
          <div className="order-1 flex min-w-0 flex-col justify-center px-5 py-12 sm:px-8 sm:py-14 lg:px-12 lg:py-16 xl:px-16">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink sm:text-sm">
              {eyebrow}
            </p>
            <h2
              id="home-nut-butter-title"
              className="mt-3 max-w-[14ch] text-[clamp(2rem,8vw,3.75rem)] font-bold leading-[1.02] tracking-heading text-contrast"
            >
              {title}
            </h2>
            <p className="mt-5 max-w-[34rem] text-sm leading-6 text-muted sm:text-base sm:leading-7">
              {body}
            </p>
            <p className="mt-3 max-w-[34rem] text-sm leading-6 text-muted sm:text-base sm:leading-7">
              {detail}
            </p>
            {highlights.length ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex min-w-0 items-start gap-2.5 py-1 text-sm leading-5 text-text"
                  >
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-contrast">
                      <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link
              href={ctaHref}
              className="mt-6 inline-flex min-h-11 w-fit touch-manipulation items-center gap-2 py-2 font-heading text-sm font-bold text-contrast underline decoration-accent decoration-[3px] underline-offset-4 transition-colors duration-hover-fast hover:text-[#705700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="relative order-2 aspect-[2/3] min-h-0 overflow-hidden bg-[#e8dccb] md:aspect-[3/2] lg:aspect-auto lg:min-h-[38rem]">
            <picture className="absolute inset-0 block">
              <source
                media="(min-width: 768px)"
                srcSet="/home/notenpasta-story-desktop.webp"
              />
              <img
                src="/home/notenpasta-story-mobile.webp"
                alt={imageAlt}
                width={1024}
                height={1536}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain object-center"
              />
            </picture>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-[#efe8dc] to-transparent lg:inset-y-0 lg:left-0 lg:h-auto lg:w-20 lg:bg-gradient-to-r"
              aria-hidden="true"
            />
          </div>
        </div>
    </section>
  );
}
