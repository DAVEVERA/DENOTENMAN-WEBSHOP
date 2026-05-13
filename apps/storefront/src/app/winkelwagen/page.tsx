import Link from "next/link";
import { ShoppingBag, ArrowRight, ShieldCheck, CreditCard } from "lucide-react";

export const metadata = {
  title: "Winkelwagen | DeNotenman",
  description: "Je winkelwagen bij DeNotenman.",
};

export default function WinkelwagenPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight text-brand-primary sm:text-4xl mb-8 flex items-center gap-3">
          <ShoppingBag className="h-8 w-8 text-brand-gold" />
          Jouw Winkelwagen
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Cart Items List */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-gold/20 shadow-sm mb-6">
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/5 mb-6">
                  <ShoppingBag className="h-10 w-10 text-brand-gold" />
                </div>
                <h2 className="text-2xl font-bold text-brand-primary mb-3">
                  Je winkelwagen is leeg
                </h2>
                <p className="text-brand-primary/70 mb-8 max-w-md mx-auto">
                  Het lijkt erop dat je nog geen van onze heerlijke verse noten of zuidvruchten hebt
                  toegevoegd.
                </p>
                <Link
                  href="/categorie/noten"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-8 py-4 text-base font-bold text-brand-gold hover:bg-brand-primary/90 hover:scale-105 transition-all shadow-lg"
                >
                  Bekijk assortiment <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-4">
            <div className="bg-brand-primary text-white rounded-3xl p-8 sticky top-24 border border-brand-gold/30 shadow-xl overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url('/Branding/Lookenfeel.png')`,
                  backgroundSize: "cover",
                }}
              ></div>
              <h2 className="text-xl font-bold text-brand-gold mb-6 relative z-10 border-b border-brand-gold/20 pb-4">
                Besteloverzicht
              </h2>

              <div className="space-y-4 text-surface/90 relative z-10 mb-8 font-medium">
                <div className="flex justify-between">
                  <span>Subtotaal</span>
                  <span>€ 0,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Verzending</span>
                  <span>Berekend bij afrekenen</span>
                </div>
                <div className="border-t border-brand-gold/20 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-brand-gold">Totaal (incl. BTW)</span>
                  <span className="text-2xl font-bold text-brand-highlight">€ 0,00</span>
                </div>
              </div>

              <button
                disabled
                className="w-full bg-brand-gold/50 text-brand-primary/50 cursor-not-allowed font-bold rounded-xl py-4 flex justify-center items-center gap-2 relative z-10"
              >
                Afrekenen
              </button>

              <div className="mt-8 space-y-3 relative z-10">
                <div className="flex items-center gap-3 text-sm text-surface/70">
                  <ShieldCheck className="h-5 w-5 text-brand-highlight" />
                  <span>Veilig en versleuteld afrekenen</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-surface/70">
                  <CreditCard className="h-5 w-5 text-brand-highlight" />
                  <span>iDEAL, Bancontact, Creditcard</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
