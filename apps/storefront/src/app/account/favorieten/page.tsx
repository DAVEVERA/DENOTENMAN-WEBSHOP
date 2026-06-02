import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";

export const metadata = {
  title: "Mijn Favorieten | DeNotenman",
  description: "Bekijk je opgeslagen producten.",
};

export default function FavorietenPage() {
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
            Mijn Favorieten
          </h1>
          <p className="mt-2 text-brand-primary/70">
            Jouw persoonlijk samengestelde lijst met favoriete producten.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-brand-gold/20 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/5 mb-6">
            <Heart className="h-10 w-10 text-brand-gold fill-brand-gold/20" />
          </div>
          <h2 className="text-2xl font-bold text-brand-primary mb-3">Geen favorieten gevonden</h2>
          <p className="text-brand-primary/70 mb-8 max-w-md mx-auto">
            Je hebt nog geen producten aan je favorieten toegevoegd. Klik op het hartje bij een
            product om deze op te slaan.
          </p>
          <Link
            href="/categorie/noten"
            className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-8 py-3.5 text-base font-bold text-brand-gold hover:bg-brand-primary/90 hover:scale-105 transition-all shadow-md"
          >
            Ontdek producten
          </Link>
        </div>
      </div>
    </div>
  );
}
