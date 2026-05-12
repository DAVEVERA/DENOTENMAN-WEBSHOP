"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl font-bold text-danger-DEFAULT opacity-30">!</p>
      <h2 className="mt-4 text-xl font-semibold text-neutral-900">Er is iets misgegaan</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Er is een onverwachte fout opgetreden. Probeer het opnieuw.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-brand-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-700 transition-colors"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
