import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, CreditCard, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Afrekenen | De Notenman",
};

export default function AfrekenPage() {
  return (
    <div className="bg-surface min-h-screen py-16 sm:py-24">
      <div className="container-shop max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/5 mb-8">
          <CreditCard className="h-10 w-10 text-brand-gold" />
        </div>
        <h1 className="text-3xl font-bold text-brand-primary mb-4">Afrekenen</h1>
        <p className="text-brand-primary/70 mb-10 text-lg">
          De betaalmogelijkheden (iDEAL, Bancontact, Creditcard) worden binnenkort toegevoegd. Neem
          contact op via{" "}
          <a
            href="mailto:bestelling@denotenman.com"
            className="text-brand-gold font-bold hover:underline"
          >
            bestelling@denotenman.com
          </a>{" "}
          om je bestelling te plaatsen.
        </p>

        <div className="bg-white rounded-2xl border border-brand-gold/20 p-6 mb-8 text-left space-y-3">
          <div className="flex items-center gap-3 text-sm text-brand-primary/80">
            <ShieldCheck className="h-5 w-5 text-brand-highlight shrink-0" />
            <span>Veilige en versleutelde betaling</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-brand-primary/80">
            <CreditCard className="h-5 w-5 text-brand-highlight shrink-0" />
            <span>iDEAL, Bancontact en Creditcard — binnenkort beschikbaar</span>
          </div>
        </div>

        <Link
          href="/winkelwagen"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-primary/70 hover:text-brand-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar winkelwagen
        </Link>
      </div>
    </div>
  );
}
