import Link from "next/link";
import { BusinessAccountCreateForm } from "./BusinessAccountCreateForm";

export default function NieuwZakelijkAccountPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/zakelijk" className="inline-flex min-h-11 items-center font-heading text-body-sm font-bold text-accent-hover underline underline-offset-4">
        ← Terug naar Zakelijk
      </Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Nieuwe zakelijke klant</p>
      <h1 className="mt-1 text-heading-lg text-text">Zakelijk account aanmaken</h1>
      <p className="mt-2 max-w-2xl text-body-sm text-muted">Leg het klantdossier alvast compleet vast, van bedrijfsregistratie en adressen tot afhaalafspraken. De klant krijgt pas toegang nadat jij vanuit het dossier de persoonlijke uitnodiging verstuurt.</p>
      <BusinessAccountCreateForm />
    </div>
  );
}
