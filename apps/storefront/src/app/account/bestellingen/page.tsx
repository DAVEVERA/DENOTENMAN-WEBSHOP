import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";

export const metadata = {
  title: "Mijn Bestellingen | DeNotenman",
  description: "Bekijk je bestelgeschiedenis.",
};

export default function BestellingenPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-5xl">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-gold hover:text-brand-highlight transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Terug naar account
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl">
            Mijn Bestellingen
          </h1>
          <p className="mt-2 text-brand-primary/70">
            Een overzicht van al je eerdere bestellingen bij DeNotenman.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-brand-gold/20 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/5 mb-6">
            <PackageSearch className="h-10 w-10 text-brand-gold" />
          </div>
          <h2 className="text-2xl font-bold text-brand-primary mb-3">Nog geen bestellingen</h2>
          <p className="text-brand-primary/70 mb-8 max-w-md mx-auto">
            Je hebt nog geen bestellingen geplaatst. Ontdek ons heerlijke assortiment en plaats je
            eerste bestelling!
          </p>
          <Link
            href="/categorie/noten"
            className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-8 py-3.5 text-base font-bold text-brand-gold hover:bg-brand-primary/90 hover:scale-105 transition-all shadow-md"
          >
            Bekijk assortiment
          </Link>
        </div>
      </div>
    </div>
  );
}
