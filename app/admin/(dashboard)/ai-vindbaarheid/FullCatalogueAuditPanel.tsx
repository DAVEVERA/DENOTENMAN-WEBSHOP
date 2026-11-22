"use client";

import { useRef, useState } from "react";
import type { BatchAuditResult } from "@/lib/ai-vindbaarheid/batch-audit";

type ScanResponse = {
  results: BatchAuditResult[];
  total: number;
  nextCursor: string | null;
  done: boolean;
  scannedAt: string;
  error?: string;
};

export function FullCatalogueAuditPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BatchAuditResult[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function begin() {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setFinished(false);
    setResults([]);
    setTotal(null);
    setError("");
    setStartedAt(new Date().toISOString());

    let cursor: string | null = null;
    const visited = new Set<string>();
    try {
      for (let page = 0; page < 10000 && !cancelRef.current; page++) {
        const controller = new AbortController();
        abortRef.current = controller;
        const response = await fetch("/api/admin/ai-vindbaarheid/catalogue-audit", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cursor ? { cursor } : {}),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Auditverzoek mislukt (HTTP ${response.status}).`);
        const data = await response.json() as ScanResponse;
        if (!Array.isArray(data.results) || typeof data.total !== "number") {
          throw new Error("De auditservice gaf een ongeldig resultaat terug.");
        }
        if (cancelRef.current) break;
        setResults((previous) => [...previous, ...data.results]);
        setTotal(data.total);
        if (data.done || data.nextCursor === null) {
          setFinished(true);
          break;
        }
        if (!data.nextCursor || visited.has(data.nextCursor)) {
          throw new Error("De cataloguscursor herhaalt zich. Audit veilig gestopt.");
        }
        visited.add(data.nextCursor);
        cursor = data.nextCursor;
        // Avoid a rapid stream of requests to the public storefront.
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (!cancelRef.current && !visited.size && total === 0) setFinished(true);
    } catch (cause) {
      if (!cancelRef.current) {
        setError(cause instanceof Error ? cause.message : "Audit onverwacht afgebroken.");
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  const pageCount = results.reduce((n, product) => n + product.pages.length, 0);
  const failures = results.reduce((n, product) =>
    n + product.pages.filter((page) => page.status < 200 || page.status >= 300).length, 0);
  const findings = results.flatMap((product) => product.findings.map((finding) => ({ ...finding, productName: product.name })));

  return (
    <section className="rounded-panel border border-border bg-surface p-5" aria-label="Volledige catalogus-audit">
      <h2 className="font-heading text-heading-md text-text">Volledige catalogus controleren</h2>
      <p className="mt-2 text-body-sm text-muted">
        Start één read-only controle van alle actieve producten met een Nederlandse vertaling.
        De scanner doorloopt automatisch maximaal zes producten per batch en controleert alle beschikbare taalpagina&apos;s.
        Resultaten blijven alleen in dit scherm zolang het geopend is; er worden geen productgegevens gewijzigd.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={running} onClick={begin}
          className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast disabled:opacity-60">
          {running ? "Catalogus wordt gecontroleerd…" : "Volledige audit starten"}
        </button>
        {running ? <button type="button" onClick={() => { cancelRef.current = true; abortRef.current?.abort(); }}
          className="min-h-11 rounded-button border border-border px-5 text-body-sm font-semibold text-text">
          Stop audit
        </button> : null}
      </div>
      {startedAt ? (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <p className="text-body-sm text-text">
            {results.length}{total !== null ? ` van ${total}` : ""} producten gecontroleerd · {pageCount} taalpagina&apos;s · {findings.length} aandachtspunten · {failures} onbereikbare pagina&apos;s.
          </p>
          {total !== null && total > 0 ? (
            <progress className="w-full" max={total} value={Math.min(results.length, total)} aria-label="Auditvoortgang" />
          ) : null}
          {finished ? <p className="text-body-sm font-semibold text-text">Cataloguscontrole voltooid.</p> : null}
          {!running && cancelRef.current ? <p className="text-body-sm text-muted">Audit gestopt. Alleen bovenstaande batches zijn gecontroleerd.</p> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-body-sm text-text">{error}</p> : null}
      {findings.length ? (
        <details className="mt-4 rounded-card border border-border p-3">
          <summary className="cursor-pointer text-body-sm font-semibold text-text">
            Bekijk {findings.length} bevindingen in uitgevoerde batches
          </summary>
          <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto">
            {findings.map((item, index) => (
              <li key={`${item.url}-${item.code}-${index}`} className="border-t border-border pt-2 text-body-sm">
                <p className="font-semibold text-text">{item.productName} · {item.locale.toUpperCase()} · {item.label}</p>
                <p className="text-muted">{item.recommendation}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-accent-hover underline">
                  Publieke pagina inspecteren
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        Dit meet technische crawlbaarheid en inhoud in de ontvangen HTML, niet of AI-systemen De Notenman aanbevelen.
        Bij grote catalogi kan de scan meerdere minuten duren. Sluit het tabblad niet tijdens de controle.
      </p>
    </section>
  );
}
