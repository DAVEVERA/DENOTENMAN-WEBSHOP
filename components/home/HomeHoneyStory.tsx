import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

export type HomeHoneyStoryProps = {
  eyebrow: string;
  title: string;
  body: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HomeHoneyStory({
  eyebrow,
  title,
  body,
  imageAlt,
  ctaLabel,
  ctaHref,
}: HomeHoneyStoryProps) {
  return (
    <section
      className="relative overflow-hidden bg-[linear-gradient(180deg,#f8f5ef_0%,#f4efe6_7rem,#f4efe6_100%)]"
      aria-labelledby="home-honey-story-title"
    >
      <picture className="absolute inset-0 hidden lg:block">
        <source
          media="(min-width: 1024px)"
          srcSet="/hero/hero-honey-desktop.webp"
        />
        <img
          src="/hero/hero-honey-desktop.webp"
          alt={imageAlt}
          width={1920}
          height={960}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </picture>

      <div
        className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(244,239,230,0.98)_0%,rgba(244,239,230,0.91)_35%,rgba(244,239,230,0.28)_58%,rgba(244,239,230,0)_72%)] lg:block"
        aria-hidden="true"
      />

      <Container
        fullWidth
        className="relative z-10 px-5 sm:px-8 lg:flex lg:min-h-[36rem] lg:items-center lg:px-12 xl:px-16"
      >
        <div className="max-w-[34rem] py-10 sm:py-14 lg:py-16">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink sm:text-sm">
            {eyebrow}
          </p>
          <h2
            id="home-honey-story-title"
            className="mt-3 max-w-[12ch] text-[clamp(2rem,8vw,3.75rem)] font-bold leading-[1.02] tracking-heading text-contrast"
          >
            {title}
          </h2>
          <p className="mt-5 max-w-[31rem] text-base leading-7 text-muted">
            {body}
          </p>
          <Link
            href={ctaHref}
            prefetch={false}
            className="mt-6 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-button bg-contrast px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors duration-hover-fast hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Container>

      <picture className="block aspect-[4/5] w-full sm:aspect-[5/4] lg:hidden">
        <img
          src="/hero/hero-honey-mobile.webp"
          alt={imageAlt}
          width={1122}
          height={1402}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain object-center"
        />
      </picture>
    </section>
  );
}
