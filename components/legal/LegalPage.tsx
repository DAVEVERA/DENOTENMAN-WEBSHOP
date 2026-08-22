import type { ReactNode } from "react";
import { FileCheck2 } from "lucide-react";
import { LEGAL_IDENTITY, LEGAL_LAST_UPDATED } from "@/lib/legal";
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-4xl">
      <header className="mb-10 text-center sm:mb-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-contrast text-accent shadow-md">
          <FileCheck2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-contrast sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>
      </header>

      <div className="rounded-panel border-t-8 border-t-accent bg-surface p-6 shadow-card sm:p-10">
        <div className="legal-copy space-y-10 text-text">{children}</div>
        <footer className="mt-12 border-t border-border pt-5 text-sm text-muted">
          <p>
            {LEGAL_IDENTITY.tradeName} · KvK {LEGAL_IDENTITY.registrationNumber} · Vestigingsnummer{" "}
            {LEGAL_IDENTITY.establishmentNumber} · {LEGAL_IDENTITY.address} · {LEGAL_IDENTITY.email}
          </p>
          <p>Laatst bijgewerkt: {LEGAL_LAST_UPDATED}.</p>
          <p className="mt-1">
            Versie: 1.0. Bewaar de versie die gold op het moment waarop u een overeenkomst sloot.
          </p>
        </footer>
      </div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 border-b border-border pb-3 text-2xl font-bold text-contrast">{title}</h2>
      <div className="space-y-4 leading-relaxed">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

export function IdentityDetails() {
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-card border border-border bg-background/40 p-5 sm:grid-cols-[12rem_1fr]">
      <dt className="font-semibold">Handelsnaam</dt>
      <dd>{LEGAL_IDENTITY.tradeName}</dd>
      <dt className="font-semibold">Ter attentie van</dt>
      <dd>{LEGAL_IDENTITY.attention}</dd>
      <dt className="font-semibold">Bedrijfsactiviteit</dt>
      <dd>{LEGAL_IDENTITY.businessDescription}</dd>
      <dt className="font-semibold">Vestigingsadres</dt>
      <dd>{LEGAL_IDENTITY.address}</dd>
      <dt className="font-semibold">KvK-nummer</dt>
      <dd>{LEGAL_IDENTITY.registrationNumber}</dd>
      <dt className="font-semibold">Vestigingsnummer</dt>
      <dd>{LEGAL_IDENTITY.establishmentNumber}</dd>
      {LEGAL_IDENTITY.sbiRegistrations.map((registration) => (
        <div className="contents" key={`${registration.source}-${registration.code}`}>
          <dt className="font-semibold">{registration.source}</dt>
          <dd>{registration.code} - {registration.description}</dd>
        </div>
      ))}
      <dt className="font-semibold">E-mail</dt>
      <dd>
        <a className="underline underline-offset-4" href={`mailto:${LEGAL_IDENTITY.email}`}>
          {LEGAL_IDENTITY.email}
        </a>
      </dd>
      <dt className="font-semibold">Website</dt>
      <dd>
        <a className="underline underline-offset-4" href={LEGAL_IDENTITY.website}>
          denotenman.com
        </a>
      </dd>
    </dl>
  );
}
