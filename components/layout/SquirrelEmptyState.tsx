import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import styles from "./SquirrelEmptyState.module.css";

const copy: Record<Locale, { title: string; body: string; cta: string }> = {
  nl: {
    title: "404 – Pagina is momenteel neit bereikbaar",
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
    <section className={styles.root} aria-labelledby="squirrel-empty-title" data-empty-page>
      <Image
        src="/pages/SQUIRREL404.PNG"
        alt=""
        fill
        preload
        sizes="100vw"
        quality={75}
        className={styles.image}
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.copy}>
          <h1 id="squirrel-empty-title" className={styles.title}>
            {content.title}
          </h1>
          <p className={styles.body}>{content.body}</p>
        </div>
        <Link className={styles.cta} href={`/${locale}`}>
          {content.cta}
        </Link>
      </div>
    </section>
  );
}
