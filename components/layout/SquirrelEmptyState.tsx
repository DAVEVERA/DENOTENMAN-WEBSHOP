import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";

const SQUIRREL_EMPTY_STYLES = String.raw`
  .squirrel-empty-root {
    position: relative;
    isolation: isolate;
    min-block-size: 100svh;
    inline-size: 100%;
    overflow: hidden;
    background: #5a3218;
  }

  .squirrel-empty-image {
    z-index: 0;
    object-fit: cover;
    object-position: 72% center;
  }

  .squirrel-empty-scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(180deg, rgb(20 9 3 / 78%) 0%, rgb(20 9 3 / 45%) 48%, rgb(20 9 3 / 16%) 76%),
      linear-gradient(90deg, rgb(20 9 3 / 52%) 0%, transparent 82%);
  }

  .squirrel-empty-content {
    position: absolute;
    z-index: 2;
    inset-block-start: max(1.5rem, env(safe-area-inset-top));
    inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    display: flex;
    max-inline-size: 34rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.25rem;
  }

  .squirrel-empty-copy {
    color: #fff;
    text-wrap: balance;
    text-shadow: 0 2px 16px rgb(0 0 0 / 65%);
  }

  .squirrel-empty-title {
    margin: 0;
    font-family: var(--font-montserrat), sans-serif;
    font-size: clamp(1.35rem, 6.8vw, 2rem);
    font-weight: 900;
    color: #fff;
    line-height: 1.08;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .squirrel-empty-body {
    margin: 0.8rem 0 0;
    max-inline-size: 31rem;
    font-family: var(--font-montserrat), sans-serif;
    font-size: clamp(0.88rem, 3.7vw, 1.05rem);
    font-weight: 700;
    color: #fff;
    line-height: 1.48;
    text-transform: uppercase;
  }

  .squirrel-empty-cta {
    display: inline-flex;
    min-block-size: 3rem;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
    border-radius: 0.65rem;
    background: #f7c600;
    padding: 0.72rem 1.15rem;
    color: #17130d;
    font-family: var(--font-montserrat), sans-serif;
    font-size: 0.94rem;
    font-weight: 800;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
    box-shadow: 0 0.35rem 1rem rgb(0 0 0 / 30%);
    transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
  }

  .squirrel-empty-cta:hover {
    background: #ffd629;
    box-shadow: 0 0.5rem 1.3rem rgb(0 0 0 / 38%);
    transform: translateY(-2px);
  }

  .squirrel-empty-cta:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 4px;
  }

  @media (min-width: 48rem) and (max-width: 63.999rem) {
    .squirrel-empty-content {
      inset-block-start: clamp(2rem, 6vh, 4rem);
      inset-inline-start: clamp(2rem, 6vw, 4rem);
    }

    .squirrel-empty-title {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
    }

    .squirrel-empty-body {
      font-size: clamp(1rem, 2vw, 1.2rem);
    }
  }

  @media (min-width: 64rem) {
    .squirrel-empty-image {
      object-position: left center;
    }

    .squirrel-empty-scrim {
      display: none;
    }

    .squirrel-empty-content {
      inset-block-start: 44%;
      inset-inline-start: clamp(2.25rem, 3.55vw, 4.25rem);
      inset-inline-end: auto;
      max-inline-size: min(32vw, 32rem);
    }

    .squirrel-empty-copy {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .squirrel-empty-cta {
      transition: none;
    }
  }
`;

const copy: Record<Locale, { title: string; body: string; cta: string }> = {
  nl: {
    title: "404 – Pagina is momenteel niet bereikbaar",
    body: "Deze pagina maakt momenteel deel uit van een plaats delict. We werken er hard aan om de sporen zo snel mogelijk veilig te stellen en de pagina weer vrij te geven.",
    cta: "Terug naar de hoofdpagina",
  },
  en: {
    title: "404 – Page under investigation",
    body: "This page is currently part of a crime scene. We are working hard to secure the evidence and release the page as soon as possible.",
    cta: "Back to the homepage",
  },
  fr: {
    title: "404 – Page sous enquête",
    body: "Cette page fait actuellement partie d’une scène de crime. Nous travaillons dur pour sécuriser les indices et remettre la page en ligne au plus vite.",
    cta: "Retour à l’accueil",
  },
};

export function SquirrelEmptyState({ locale }: { locale: Locale }) {
  const content = copy[locale];

  return (
    <section className="squirrel-empty-root" aria-labelledby="squirrel-empty-title" data-empty-page>
      <style>{SQUIRREL_EMPTY_STYLES}</style>
      <Image
        src="/pages/SQUIRREL404.PNG"
        alt=""
        fill
        preload
        sizes="100vw"
        quality={75}
        className="squirrel-empty-image"
      />
      <div className="squirrel-empty-scrim" aria-hidden="true" />
      <div className="squirrel-empty-content">
        <div className="squirrel-empty-copy">
          <h1 id="squirrel-empty-title" className="squirrel-empty-title">
            {content.title}
          </h1>
          <p className="squirrel-empty-body">{content.body}</p>
        </div>
        <Link className="squirrel-empty-cta" href={`/${locale}`}>
          {content.cta}
        </Link>
      </div>
    </section>
  );
}
