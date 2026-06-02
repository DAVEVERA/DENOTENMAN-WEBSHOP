import Link from "next/link";
import { ArrowLeft, MapPin, Plus } from "lucide-react";

export const metadata = {
  title: "Adresboek | DeNotenman",
  description: "Beheer je verzend- en factuuradressen.",
};

export default function AdressenPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 border-b border-brand-gold/30 pb-6 gap-4">
          <div>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-gold hover:text-brand-highlight transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Terug naar account
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl">
              Adresboek
            </h1>
            <p className="mt-2 text-brand-primary/70">
              Beheer je aflever- en factuuradressen voor een snellere checkout.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-brand-gold shadow-md hover:bg-brand-primary/90 hover:scale-105 transition-all">
            <Plus className="h-4 w-4" /> Nieuw adres
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Address */}
          <div className="bg-white rounded-3xl p-8 border-2 border-brand-gold shadow-md relative">
            <span className="absolute top-0 right-8 -translate-y-1/2 bg-brand-gold text-brand-primary text-xs font-bold px-3 py-1 rounded-full">
              Standaard
            </span>
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <MapPin className="h-6 w-6 text-brand-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-brand-primary mb-1">Thuis</h3>
                <address className="not-italic text-brand-primary/80 space-y-1 mb-6">
                  <p>Klant Naam</p>
                  <p>Straatnaam 123</p>
                  <p>1234 AB, Woonplaats</p>
                  <p>Nederland</p>
                </address>
                <div className="flex gap-4">
                  <button className="text-sm font-bold text-brand-gold hover:text-brand-highlight transition-colors">
                    Bewerken
                  </button>
                  <button className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors">
                    Verwijderen
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder for adding easily */}
          <button className="bg-brand-primary/5 rounded-3xl p-8 border-2 border-dashed border-brand-gold/40 hover:bg-brand-primary/10 transition-colors flex flex-col items-center justify-center text-center group h-full min-h-[200px]">
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="h-6 w-6 text-brand-gold" />
            </div>
            <span className="text-brand-primary font-bold">Voeg een nieuw adres toe</span>
          </button>
        </div>
      </div>
    </div>
  );
}
