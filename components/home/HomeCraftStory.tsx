import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

export type HomeCraftStoryProps = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HomeCraftStory({
  eyebrow,
  title,
  body,
  points,
  imageSrc,
  imageAlt,
  ctaLabel,
  ctaHref,
}: HomeCraftStoryProps) {
  return (
    <section
      data-home-section="craft-story"
      className="overflow-hidden bg-transparent"
      aria-labelledby="home-craft-title"
    >
      <div className="grid min-w-0 lg:grid-cols-2 lg:items-stretch">
          <div className="relative order-2 min-h-[20rem] min-w-0 bg-transparent sm:min-h-[27rem] lg:order-1 lg:min-h-[36rem]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain object-bottom px-2 pt-5 sm:px-5 sm:pt-7 lg:px-7 lg:pt-9"
              loading="lazy"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-b from-transparent to-home-canvas lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-20 lg:bg-gradient-to-r"
              aria-hidden="true"
            />
          </div>

          <div className="order-1 flex min-w-0 flex-col justify-center bg-transparent px-5 py-10 sm:px-8 sm:py-12 lg:order-2 lg:px-12 lg:py-16 xl:px-16">
            <p className="w-fit rounded-full bg-[#eadbaf] px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#705700]">
              {eyebrow}
            </p>
            <h2 id="home-craft-title" className="mt-4 text-[clamp(1.75rem,7vw,2.75rem)] leading-tight text-contrast">
              {title}
            </h2>
            <p className="mt-4 max-w-[38rem] text-base leading-7 text-muted">{body}</p>
            {points.length ? (
              <ul className="mt-6 grid gap-3">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-base leading-6 text-text">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-contrast" aria-hidden="true">
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link
              href={ctaHref}
              className="mt-7 inline-flex min-h-11 w-fit touch-manipulation items-center justify-center rounded-button bg-accent px-5 py-2.5 font-heading text-sm font-bold text-contrast shadow-button transition-[background-color,transform] duration-hover-fast hover:bg-[#f1ca18] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast"
            >
              {ctaLabel}
            </Link>
          </div>
      </div>
    </section>
  );
}
