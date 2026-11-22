"use client";

import { useState } from "react";
import type { FactKind } from "@/lib/ai-vindbaarheid/fact-reconciliation";
import type { SourceSearchResult } from "@/lib/ai-vindbaarheid/gemini-source-search";

type Variant = { id: string; sku: string; weightGrams: number };
type Props = { productId: string; variants: Variant[] };

const FIELDS: { value: FactKind; label: string }[] = [
  { value: "ingredients", label: "Ingrediënten" },
  { value: "allergens", label: "Allergenen" },
  { value: "mayContainTraces", label: "Mogelijke sporen" },
  { value: "nutrition", label: "Voedingswaarden" },
];

export function AiSourceResearchPanel({ productId, variants }: Props) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [field, setField] = useState<FactKind>("ingredients");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SourceSearchResult | null>(null);
  const [error, setError] = useState("");

  async function runResearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !variantId) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/ai-vindbaarheid/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, field }),
        cache: "no-store",
      });
      const payload = await response.json() as SourceSearchResult & { error?: string };
      if (payload.status === "not_configured") {
        setError("Online brononderzoek is nog niet geconfigureerd. De server mist de zoek-API-sleutel.");
      } else if (!response.ok) {
        setError("Brononderzoek mislukt. Controleer de rechten en probeer het later opnieuw.");
      } else {
        setResult(payload);
      }
    } catch {
      setError("De zoekservice is momenteel niet bereikbaar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-5" aria-label="Online productbrononderzoek">
      <h3 className="font-heading text-heading-md text-text">Online productbrononderzoek</h3>
      <p className="mt-2 text-body-sm text-muted">
        Doorzoek het web naar productspecificaties en etiketten voor de gekozen variant.
        Resultaten zijn onderzoekskandidaten, geen gecontroleerde ingrediënten of voedingswaarden.
        Er worden geen productgegevens aangepast.
      </p>
      <form onSubmit={runResearch} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-body-sm font-semibold text-text">
          Variant
          <select className="min-h-11 rounded-button border border-border bg-background px-3" value={variantId}
            onChange={(event) => { setVariantId(event.target.value); setResult(null); }}>
            {variants.map((variant) => <option key={variant.id} value={variant.id}>
              {variant.sku} ({variant.weightGrams} g)
            </option>)}
          </select>
        </label>
        <label className="grid gap-2 text-body-sm font-semibold text-text">
          Onderzoek
          <select className="min-h-11 rounded-button border border-border bg-background px-3" value={field}
            onChange={(event) => { setField(event.target.value as FactKind); setResult(null); }}>
            {FIELDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading || !variantId}
          className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast disabled:opacity-60">
          {loading ? "Bronnen zoeken..." : "Zoek betrouwbare bronnen"}
        </button>
      </form>
      {error ? <p role="alert" className="mt-4 text-body-sm text-text">{error}</p> : null}
      {result && (result.status === "complete" || result.status === "partial") ? (
        <div className="mt-5">
          <p role="status" className="text-body-sm text-text">
            {result.candidates.length} unieke kandidaten gevonden.
            {result.status === "partial" ? " Sommige zoekacties mislukten." : ""}
            Geen bron is automatisch goedgekeurd.
          </p>
          {result.candidates.length ? (
            <ul className="mt-3 space-y-3">
              {result.candidates.map((candidate) => <li key={candidate.url}
                className="rounded-card border border-border p-3 text-body-sm">
                <a href={candidate.url} target="_blank" rel="noopener noreferrer"
                  className="break-all font-semibold text-accent-hover underline">{candidate.title}</a>
                <p className="mt-1 text-muted">{candidate.excerpt}</p>
                <p className="mt-1 text-xs text-muted">
                  Nog te verifiëren{candidate.confidenceSignals.length ? ` · ${candidate.confidenceSignals.join(" · ")}` : ""}
                </p>
              </li>)}
            </ul>
          ) : <p className="mt-2 text-body-sm text-muted">Nog geen bruikbare bron gevonden. Dit productfeit blijft onderzoekswaardig.</p>}
        </div>
      ) : null}
    </section>
  );
}
