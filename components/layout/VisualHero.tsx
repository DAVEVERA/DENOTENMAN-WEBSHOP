import Image from "next/image";
import type nl from "@/dictionaries/nl.json";

export function VisualHero({ dictionary }: { dictionary: typeof nl }) {
  return (
    <section className="visual-hero" aria-labelledby="visual-hero-title">
      <Image
        src="/hero/wellness-lifestyle-product-labels.webp"
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        quality={75}
        className="visual-hero__image"
      />
      <div className="visual-hero__grain" aria-hidden="true" />
      <h1 id="visual-hero-title" className="sr-only">
        {dictionary.hero.accessibleHeadline}
      </h1>
    </section>
  );
}
