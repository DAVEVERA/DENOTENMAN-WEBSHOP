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
 * - hero-honey-mobile.webp: a landscape product-grid shot with jars packed
 *   edge-to-edge — there's no clean run of empty space for text to sit on.
 * - hero-nutbutter-mobile.webp: an already full-bleed portrait shot (person +
 *   product wall) that fills a portrait box edge-to-edge with minimal margin.
 *
 * The image is always full-bleed behind the hero (no reserved "text zone"
 * pushing it down the page — that's what made the text card previously read
 * as a separate block stacked above the photo instead of sitting on it).
 * What differs per slide is how the text is anchored on top of that photo:
 * - `textAnchor: "top"` (nuts): the photo's own bare-counter area is plain
 *   and light, so the frosted white card can sit directly on it near the
 *   top with no extra scrim needed for legibility.
 * - `textAnchor: "bottom"` (honey, nutbutter): the frame is busy edge-to-edge,
 *   so the card becomes a borderless text block sitting on a dark gradient
 *   scrim anchored to the bottom of the photo instead.
 *
 * Keyed by `mobileImage` (stable across locales) rather than `id` (which is
 * translated per locale).
 */
type MobileHeroImageTreatment = {
  /** Tailwind class(es) controlling how much space is reserved above the
   * image on mobile/sm. Full-bleed by default ("top-0") — only override for
   * a future photo that genuinely needs breathing room above it. */
  top: string;
  /** object-fit + object-position classes for the mobile/sm crop (desktop's
   * `lg:object-contain lg:object-center` is applied unconditionally and
   * always wins at that breakpoint, independent of this value). */
  imageClassName: string;
  naturalSize: { width: number; height: number };
  /** Where the text sits on top of the photo. See comment above. */
  textAnchor: "top" | "bottom";
};

const DEFAULT_MOBILE_HERO_IMAGE_TREATMENT: MobileHeroImageTreatment = {
  top: "top-0",
  imageClassName: "object-contain object-bottom",
  naturalSize: { width: 1122, height: 1402 },
  textAnchor: "bottom",
};

const MOBILE_HERO_IMAGE_TREATMENTS: Record<string, MobileHeroImageTreatment> = {
  "/hero/hero-nuts-mobile.webp": {
    // The bowl only occupies the bottom-right ~40% of the frame; the rest is
    // bare, light marble. Contain-fit anchored top-right shows the whole
    // photo (bowl included, never cropped) with the plain counter surfacing
    // right where the text card sits.
    top: "top-0",
    imageClassName: "object-contain object-right-top",
    naturalSize: { width: 1024, height: 1536 },
    textAnchor: "top",
  },
  "/hero/hero-honey-mobile.webp": {
    // Landscape source in a portrait box: cover fills the box completely
    // (cropping the sides slightly) instead of leaving a blank band. Jars
    // are packed edge-to-edge, so the text sits on a bottom scrim instead
    // of directly on the photo.
    top: "top-0",
    imageClassName: "object-cover object-center",
    naturalSize: { width: 1024, height: 768 },
    textAnchor: "bottom",
  },
  "/hero/hero-nutbutter-mobile.webp": {
    // Full-bleed portrait of Fedor holding jars over a product pyramid.
    // Cover-fit anchored top keeps his face intact (never cropped) while
    // trimming a little off the outer jars at the sides/bottom, where a
    // bottom scrim carries the text instead of covering his face.
    top: "top-0",
    imageClassName: "object-cover object-top",
    naturalSize: { width: 1122, height: 1402 },
    textAnchor: "bottom",
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

  const activeTreatment = getMobileHeroImageTreatment(activeSlide.mobileImage);
  const isBottomAnchored = activeTreatment.textAnchor === "bottom";

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
                    "absolute inset-0 h-full w-full lg:object-contain lg:object-center",
                    treatment.imageClassName,
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

      {/* Dark scrim so text stays legible sitting directly on a busy,
          edge-to-edge product photo (honey, notenpasta). Sits above the
          light canvas fade above so the bottom of the scrim doesn't get
          washed out by it; hidden on desktop, which never needed a scrim. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[26rem] bg-gradient-to-t from-[#1f170f]/97 via-[#1f170f]/80 via-45% to-transparent transition-opacity duration-700 motion-reduce:transition-none sm:h-[23rem] lg:hidden",
          isBottomAnchored ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      <Container
        className={cn(
          "relative z-10 flex min-h-[46rem] pt-5 sm:min-h-[44rem] sm:pt-7 lg:min-h-[38rem] lg:items-center lg:pb-32 lg:pt-10 xl:min-h-[clamp(39rem,42vw,44rem)]",
          // The category-entrances section right below pulls itself up by
          // 5.25rem/5.5rem (see HomeCategoryEntrances' -mt-[5.25rem]) and
          // stacks above the hero (z-20 > z-10), so the bottom-anchored
          // card needs enough clearance or its CTA ends up hidden behind
          // that overlap.
          isBottomAnchored ? "items-end pb-24 sm:pb-28" : "items-start pb-28",
        )}
      >
        <div
          className={cn(
            "max-w-[31rem] p-4 sm:p-6 lg:max-w-[24rem] lg:p-0 xl:max-w-[28rem]",
            !isBottomAnchored &&
              "rounded-[0.85rem] border border-white/70 bg-white/[0.84] shadow-[0_16px_44px_rgba(35,27,18,0.11)] backdrop-blur-md lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none",
          )}
          aria-live={isPaused ? "polite" : "off"}
          aria-atomic="true"
        >
          <p
            className={cn(
              "font-heading text-xs font-bold uppercase tracking-[0.16em] sm:text-sm",
              isBottomAnchored ? "text-white/90 lg:text-accent-ink" : "text-accent-ink",
            )}
          >
            {activeSlide.eyebrow}
          </p>
          <h1
            className={cn(
              "mt-3 max-w-[12ch] text-[clamp(2.2rem,10vw,3.35rem)] font-bold leading-[0.96] tracking-heading lg:max-w-[10.5ch] lg:text-[clamp(3.1rem,4.4vw,4.1rem)]",
              isBottomAnchored ? "text-white lg:text-contrast" : "text-contrast",
            )}
          >
            {activeSlide.title}
          </h1>
          <p
            className={cn(
              "mt-4 max-w-[29rem] text-[clamp(0.9375rem,3.7vw,1.0625rem)] leading-6 sm:leading-7",
              isBottomAnchored ? "text-white/85 lg:text-[#554b42]" : "text-[#554b42]",
            )}
          >
            {activeSlide.description}
          </p>
          <Link
            href={activeSlide.ctaHref}
            prefetch={false}
            className={cn(
              "mt-5 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-button px-4 py-2.5 font-heading text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden",
              isBottomAnchored
                ? "bg-white text-contrast hover:bg-white/90 focus-visible:outline-white"
                : "bg-contrast text-white hover:bg-accent-ink focus-visible:outline-contrast",
            )}
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
