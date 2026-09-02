"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

export type HomeHeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageAlt: string;
  desktopImage: string;
  mobileImage: string;
  ctaLabel: string;
  ctaHref: string;
};

export type HomeHeroProps = {
  carouselLabel: string;
  slideLabel: string;
  slides: HomeHeroSlide[];
};

const AUTOPLAY_DELAY = 8_000;
const SWIPE_THRESHOLD = 42;

/**
 * Mobile hero imagery is art-directed per slide (see `mobileImage` in the
 * dictionaries), and the three source photos are framed very differently:
 * - hero-nuts-mobile.webp: a small bowl sits in the bottom-right corner of a
 *   tall, mostly-empty marble backdrop (~57% of the frame is bare counter).
 * - hero-honey-mobile.webp: a landscape product-grid shot, which leaves
 *   letterboxing above/below when contain-fit into a portrait box.
 * - hero-nutbutter-mobile.webp: an already full-bleed portrait shot (person +
 *   product wall) that fills a portrait box edge-to-edge with minimal margin.
 *
 * Rather than one blanket `object-contain object-bottom` treatment for every
 * slide, each image gets its own crop/fit + reserved top offset so the
 * product actually fills the visible mobile viewport instead of floating in
 * dead space. Keyed by `mobileImage` (stable across locales) rather than
 * `id` (which is translated per locale).
 */
type MobileHeroImageTreatment = {
  /** Tailwind class(es) controlling how much space is reserved above the
   * image on mobile/sm, i.e. how tall the image box ends up being. */
  top: string;
  fit: "cover" | "contain";
  position: string;
  naturalSize: { width: number; height: number };
};

const DEFAULT_MOBILE_HERO_IMAGE_TREATMENT: MobileHeroImageTreatment = {
  top: "top-[22rem] sm:top-[19rem]",
  fit: "contain",
  position: "object-bottom",
  naturalSize: { width: 1122, height: 1402 },
};

const MOBILE_HERO_IMAGE_TREATMENTS: Record<string, MobileHeroImageTreatment> = {
  "/hero/hero-nuts-mobile.webp": {
    // The bowl only occupies the bottom-right ~40% of the source frame, so
    // contain-fit (which preserves the whole image, dead space included)
    // just shrinks the whole problem down. Cropping in with object-fit:
    // cover — anchored bottom-right, where the bowl actually sits — and a
    // shorter reserved box (more top offset) zooms into the product instead.
    top: "top-[25rem] sm:top-[22rem]",
    fit: "cover",
    position: "object-right-bottom",
    naturalSize: { width: 1024, height: 1536 },
  },
  "/hero/hero-honey-mobile.webp": {
    // Landscape source in a portrait box: cover fills the box completely
    // (cropping the sides slightly) instead of leaving a blank band.
    top: "top-[22.5rem] sm:top-[19.5rem]",
    fit: "cover",
    position: "object-center",
    naturalSize: { width: 1024, height: 768 },
  },
  "/hero/hero-nutbutter-mobile.webp": {
    // Already a tight, full-bleed portrait composition — contain-fit keeps
    // the whole figure safely in frame; only the reserved top offset needed
    // trimming to match the (short) text card above it.
    top: "top-[22rem] sm:top-[19rem]",
    fit: "contain",
    position: "object-bottom",
    naturalSize: { width: 1122, height: 1402 },
  },
};

function getMobileHeroImageTreatment(mobileImage: string): MobileHeroImageTreatment {
  return MOBILE_HERO_IMAGE_TREATMENTS[mobileImage] ?? DEFAULT_MOBILE_HERO_IMAGE_TREATMENT;
}

export function HomeHero({
  carouselLabel,
  slideLabel,
  slides,
}: HomeHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const activeSlide = slides[activeIndex];

  const showSlide = useCallback(
    (index: number) => {
      if (!slides.length) return;
      setActiveIndex((index + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setPrefersReducedMotion(reduceMotion.matches);
    };

    updateMotionPreference();
    reduceMotion.addEventListener("change", updateMotionPreference);

    return () => {
      reduceMotion.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (
      slides.length < 2 ||
      isPaused ||
      prefersReducedMotion ||
      !isPageVisible
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_DELAY);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, isPageVisible, isPaused, prefersReducedMotion, slides.length]);

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") setIsPaused(true);
  }

  function handlePointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") setIsPaused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(activeIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setIsPaused(true);
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);

    if (Math.abs(distance) < SWIPE_THRESHOLD) return;
    showSlide(activeIndex + (distance < 0 ? 1 : -1));
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsPaused(false);
    }
  }

  if (!activeSlide) return null;

  const currentSlideLabel = slideLabel
    .replace("{current}", String(activeIndex + 1))
    .replace("{total}", String(slides.length));

  return (
    <section
      data-home-section="hero"
      className="relative isolate min-h-[46rem] overflow-hidden bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-contrast sm:min-h-[44rem] lg:min-h-[38rem] xl:min-h-[clamp(39rem,42vw,44rem)]"
      role="region"
      aria-roledescription="carousel"
      aria-label={carouselLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div className="absolute inset-0 z-0" aria-live="off">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const treatment = getMobileHeroImageTreatment(slide.mobileImage);

          return (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
                isActive ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={!isActive}
            >
              <picture
                className={cn(
                  "absolute inset-x-0 bottom-[5.5rem] block lg:bottom-[5.25rem] lg:top-0",
                  treatment.top,
                )}
              >
                <source
                  media="(min-width: 1024px)"
                  srcSet={slide.desktopImage}
                />
                <img
                  src={slide.mobileImage}
                  alt={isActive ? slide.imageAlt : ""}
                  width={treatment.naturalSize.width}
                  height={treatment.naturalSize.height}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  className={cn(
                    "absolute inset-0 h-full w-full lg:object-center",
                    treatment.fit === "cover"
                      ? "object-cover lg:object-contain"
                      : "object-contain",
                    treatment.position,
                  )}
                />
              </picture>
            </div>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-36 bg-gradient-to-b from-transparent via-home-canvas/70 to-home-canvas"
        aria-hidden="true"
      />

      <Container className="relative z-10 flex min-h-[46rem] items-start pb-28 pt-5 sm:min-h-[44rem] sm:pt-7 lg:min-h-[38rem] lg:items-center lg:pb-32 lg:pt-10 xl:min-h-[clamp(39rem,42vw,44rem)]">
        <div
          className="max-w-[31rem] rounded-[0.85rem] border border-white/70 bg-white/[0.84] p-4 shadow-[0_16px_44px_rgba(35,27,18,0.11)] backdrop-blur-md sm:p-6 lg:max-w-[24rem] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none xl:max-w-[28rem]"
          aria-live={isPaused ? "polite" : "off"}
          aria-atomic="true"
        >
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink sm:text-sm">
            {activeSlide.eyebrow}
          </p>
          <h1 className="mt-3 max-w-[12ch] text-[clamp(2.2rem,10vw,3.35rem)] font-bold leading-[0.96] tracking-heading text-contrast lg:max-w-[10.5ch] lg:text-[clamp(3.1rem,4.4vw,4.1rem)]">
            {activeSlide.title}
          </h1>
          <p className="mt-4 max-w-[29rem] text-[clamp(0.9375rem,3.7vw,1.0625rem)] leading-6 text-[#554b42] sm:leading-7">
            {activeSlide.description}
          </p>
          <Link
            href={activeSlide.ctaHref}
            prefetch={false}
            className="mt-5 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-button bg-contrast px-4 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast lg:hidden"
          >
            {activeSlide.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>

      <p
        className="sr-only"
        aria-live={isPaused ? "polite" : "off"}
        aria-atomic="true"
      >
        {currentSlideLabel}: {activeSlide.title}
      </p>
    </section>
  );
}
