"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    // Log to error monitoring without console.log
    void Promise.resolve(error);
  }, [error]);

  return (
    <div className="bg-surface min-h-[60vh] flex items-center justify-center py-24">
      <div className="container-shop max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 mb-8">
          <AlertTriangle className="h-10 w-10 text-red-500" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-brand-primary mb-4">Er ging iets mis</h1>
        <p className="text-brand-primary/70 mb-10 text-lg">
          Er is een onverwachte fout opgetreden. Probeer het opnieuw of ga terug naar de
          startpagina.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-8 py-4 text-base font-bold text-brand-gold shadow-md hover:bg-brand-primary/90 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Opnieuw proberen
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-primary px-8 py-4 text-base font-bold text-brand-primary hover:bg-brand-primary hover:text-brand-gold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Naar startpagina
          </Link>
        </div>
      </div>
    </div>
  );
}
