import Link from "next/link";
import { Mail } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { pagePath } from "@/lib/pages";
import { Container } from "@/components/ui/Container";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    intro: string;
    instruction: string;
    help: string;
    contact: string;
  }
> = {
  nl: {
    eyebrow: "Nieuwsbrief",
    title: "Afmelden voor de nieuwsbrief",
    intro: "Je kunt je veilig afmelden via de persoonlijke afmeldlink onderaan iedere nieuwsbrief.",
    instruction:
      "Open de laatste nieuwsbrief van De Notenman en kies onderaan voor ‘Afmelden’. Je e-mailadres wordt dan rechtstreeks bij onze nieuwsbriefdienst afgemeld.",
    help: "Geen nieuwsbrief meer bij de hand of lukt afmelden niet? Neem dan contact met ons op.",
    contact: "Neem contact op",
  },
  en: {
    eyebrow: "Newsletter",
    title: "Unsubscribe from the newsletter",
    intro: "You can unsubscribe securely using the personal unsubscribe link at the bottom of every newsletter.",
    instruction:
      "Open the latest De Notenman newsletter and choose ‘Unsubscribe’ at the bottom. Your email address will be removed directly by our newsletter provider.",
    help: "No longer have a newsletter or having trouble unsubscribing? Please contact us.",
    contact: "Contact us",
  },
  fr: {
    eyebrow: "Newsletter",
    title: "Se désinscrire de la newsletter",
    intro: "Vous pouvez vous désinscrire en toute sécurité via le lien personnel au bas de chaque newsletter.",
    instruction:
      "Ouvrez la dernière newsletter de De Notenman et choisissez ‘Se désinscrire’ en bas. Votre adresse e-mail sera retirée directement par notre prestataire de newsletter.",
    help: "Vous n’avez plus de newsletter ou la désinscription ne fonctionne pas ? Contactez-nous.",
    contact: "Nous contacter",
  },
};

export function NewsletterOptOut({ locale }: { locale: Locale }) {
  const content = copy[locale];

  return (
    <main className="border-y border-border bg-surface">
      <Container className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl rounded-panel border border-border bg-background p-6 shadow-card sm:p-8 lg:p-10">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
            {content.eyebrow}
          </p>
          <h1 className="mt-3 text-heading-xl text-text sm:text-[3rem]">{content.title}</h1>
          <p className="mt-5 text-body-lg leading-8 text-text">{content.intro}</p>
          <p className="mt-4 leading-7 text-muted">{content.instruction}</p>
          <p className="mt-6 leading-7 text-muted">{content.help}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={pagePath("contact", locale)}
              className="inline-flex min-h-12 items-center justify-center rounded-button bg-accent px-6 py-3 font-heading font-bold text-contrast shadow-button transition-colors hover:bg-accent-hover"
            >
              {content.contact}
            </Link>
            <a
              href={`mailto:${LEGAL_IDENTITY.email}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button border border-border px-6 py-3 font-heading font-bold text-text transition-colors hover:border-accent"
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              {LEGAL_IDENTITY.email}
            </a>
          </div>
        </div>
      </Container>
    </main>
  );
}
