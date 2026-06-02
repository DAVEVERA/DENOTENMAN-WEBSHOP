import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pagina niet gevonden",
};

export default function NotFound() {
  return (
    <div className="bg-surface min-h-[70vh] flex items-center justify-center py-24">
      <div className="container-shop max-w-lg text-center">
        <p className="text-8xl font-bold text-brand-gold mb-6" aria-hidden="true">
          404
        </p>
        <h1 className="text-3xl font-bold text-brand-primary mb-4">Pagina niet gevonden</h1>
        <p className="text-brand-primary/70 mb-10 text-lg">
          De pagina die je zoekt bestaat niet of is verplaatst.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-8 py-4 text-base font-bold text-brand-gold shadow-md hover:bg-brand-primary/90 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Naar startpagina
          </Link>
          <Link
            href="/categorie/noten"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-primary px-8 py-4 text-base font-bold text-brand-primary hover:bg-brand-primary hover:text-brand-gold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Bekijk assortiment
          </Link>
        </div>
      </div>
    </div>
  );
}
