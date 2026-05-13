import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export const metadata = {
  title: "Mijn Gegevens | DeNotenman",
  description: "Bewerk je persoonlijke gegevens.",
};

export default function GegevensPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-3xl">
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-gold hover:text-brand-highlight transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Terug naar account
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl">
            Mijn Gegevens
          </h1>
          <p className="mt-2 text-brand-primary/70">Beheer en update je persoonlijke informatie.</p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-brand-gold/20 shadow-sm">
          <form className="space-y-8" action="#" method="POST">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-brand-primary border-b border-brand-gold/20 pb-2">
                Persoonlijke informatie
              </h2>
              <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6">
                <div>
                  <label
                    htmlFor="first-name"
                    className="block text-sm font-bold text-brand-primary"
                  >
                    Voornaam
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="first-name"
                      defaultValue="Klant"
                      className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm bg-surface/50"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-sm font-bold text-brand-primary">
                    Achternaam
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="last-name"
                      defaultValue="Naam"
                      className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm bg-surface/50"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-brand-primary">
                  E-mailadres
                </label>
                <div className="mt-2">
                  <input
                    type="email"
                    id="email"
                    defaultValue="klant@voorbeeld.nl"
                    className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm bg-surface/50"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-bold text-brand-primary">
                  Telefoonnummer
                </label>
                <div className="mt-2">
                  <input
                    type="tel"
                    id="phone"
                    className="block w-full rounded-xl border-0 py-3 px-4 text-brand-primary shadow-sm ring-1 ring-inset ring-brand-gold/30 placeholder:text-brand-primary/40 focus:ring-2 focus:ring-inset focus:ring-brand-gold sm:text-sm bg-surface/50"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="flex justify-center items-center gap-2 rounded-xl bg-brand-primary px-8 py-3.5 text-base font-bold text-brand-gold shadow-md hover:bg-brand-primary/90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary transition-all"
              >
                <Save className="h-5 w-5" /> Wijzigingen opslaan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
