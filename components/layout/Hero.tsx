"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import { cn } from "@/lib/cn";

export type HeroSlide = {
  id: string;
  image: string | null;
  imageAlt: string;
  heading: string;
  ctaLabel: string;
  ctaHref: string;
};

export function Hero({
  slides,
  dictionary,
}: {
  slides: HeroSlide[];
  dictionary: typeof nl;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const hasMultiple = slides.length > 1;

  const goTo = useCallback(
    (next: number) => {
      setIndex((current) => {
        const length = slides.length;
        if (length === 0) return current;
        return ((next % length) + length) % length;
      });
    },
    [slides.length]
  );

  useEffect(() => {
    if (!hasMultiple) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => goTo(index + 1), 6000);
    return () => window.clearInterval(timer);
  }, [hasMultiple, index, goTo]);

  const slide = slides[index];

  if (!slide) return null;

  return (
    <section className="border-b border-border bg-background">
      <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-0">
        <div className="order-2 px-4 py-8 sm:px-6 sm:py-10 lg:order-1 lg:px-12 lg:py-20">
          <h1 className="max-w-md text-heading-md font-bold leading-tight sm:text-heading-lg lg:text-heading-xl">
            {slide.heading}
          </h1>
          <a
            href={slide.ctaHref}
            className="mt-4 inline-flex items-center gap-2 font-heading text-body-md font-bold text-accent-hover transition-colors duration-hover-fast hover:text-accent sm:mt-6 sm:text-body-lg"
          >
            {slide.ctaLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div
          className="relative order-1 aspect-[4/3] w-full overflow-hidden bg-surface sm:aspect-[16/9] lg:order-2 lg:aspect-auto lg:h-full lg:min-h-[22rem]"
          role={hasMultiple ? "group" : undefined}
          aria-roledescription={hasMultiple ? "carousel" : undefined}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const delta = event.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(delta) > 40) {
              goTo(index + (delta < 0 ? 1 : -1));
            }
            touchStartX.current = null;
          }}
        >
          {slide.image ? (
            <img src={slide.image} alt={slide.imageAlt} className="h-full w-full object-cover" />
          ) : null}
          {hasMultiple ? (
            <>
              <button
                type="button"
                aria-label={dictionary.hero.previous}
                onClick={() => goTo(index - 1)}
                className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-card transition-colors duration-hover-fast hover:border-border-hover hover:text-accent-hover"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={dictionary.hero.next}
                onClick={() => goTo(index + 1)}
                className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-card transition-colors duration-hover-fast hover:border-border-hover hover:text-accent-hover"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                {slides.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={dictionary.hero.goToSlide.replace("{n}", String(itemIndex + 1))}
                    aria-current={itemIndex === index}
                    onClick={() => goTo(itemIndex)}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border border-surface transition-colors duration-hover-fast",
                      itemIndex === index ? "bg-accent" : "bg-surface/60"
                    )}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
