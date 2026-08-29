import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

export type HomeAssortmentCtaProps = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HomeAssortmentCta({ title, body, ctaLabel, ctaHref }: HomeAssortmentCtaProps) {
  return (
    <section
      data-home-section="assortment-cta"
      className="bg-transparent px-4 py-10 text-surface sm:px-6 sm:py-12 lg:px-10 lg:py-14 xl:px-14 2xl:px-16"
      aria-labelledby="home-assortment-title"
    >
      <Container fullWidth className="flex flex-col gap-6 rounded-[0.85rem] bg-[#121212] px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-8 sm:py-9 lg:px-10 xl:px-12">
        <div className="max-w-2xl">
          <h2 id="home-assortment-title" className="text-[clamp(1.625rem,7vw,2.5rem)] leading-tight text-surface">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-surface/75 sm:text-base">{body}</p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex min-h-12 w-full shrink-0 touch-manipulation items-center justify-center gap-2 rounded-button bg-accent px-5 py-3 font-heading text-base font-bold text-contrast shadow-button transition-[background-color,transform] duration-hover-fast hover:bg-surface active:translate-y-px sm:w-auto"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}
