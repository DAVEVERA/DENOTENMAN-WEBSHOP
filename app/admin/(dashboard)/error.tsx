"use client";

import { useEffect } from "react";

export default function AdminDashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin dashboard render failed", { digest: error.digest });
  }, [error]);

  return (
    <section role="alert" className="rounded-panel border border-red-200 bg-red-50 p-6 shadow-card">
      <h1 className="font-heading text-xl font-bold text-red-900">Beheerpagina kon niet worden geladen</h1>
      <p className="mt-2 text-body-sm text-red-800">Je wijzigingen zijn niet opgeslagen. Probeer deze pagina opnieuw te laden.</p>
      <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-button bg-text px-4 font-semibold text-white">
        Opnieuw proberen
      </button>
    </section>
  );
}
