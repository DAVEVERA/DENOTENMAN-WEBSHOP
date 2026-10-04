"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { CANVA_CALLBACK_PATH, CANVA_RETURN_PATH, CANVA_SCOPES } from "@/lib/canva/config";

type Summary = { configured: boolean; connected: boolean; displayName: string | null; connectedAt: string | null };

const chip: Record<"ready" | "attention" | "missing", string> = {
  ready: "bg-green-100 text-green-800",
  attention: "bg-amber-100 text-amber-900",
  missing: "bg-red-50 text-red-800",
};

/** Status, setup checklist and connect/disconnect for the shop's Canva account. */
export function CanvaConnectionCard({ initial, notice, siteUrl, returnTo }: { initial: Summary; notice: string | null; siteUrl: string; returnTo: string }) {
  const [summary, setSummary] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    notice?.startsWith("verbonden") ? `Canva is gekoppeld${notice.includes(":") ? ` als ${notice.slice(notice.indexOf(":") + 1)}` : ""}.` : notice,
  );
  const state = !summary.configured ? "missing" : summary.connected ? "ready" : "attention";
  const base = siteUrl.replace(/\/+$/u, "");

  async function disconnect() {
    if (!window.confirm("Canva ontkoppelen voor het hele portaal?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/canva/disconnect", { method: "POST", headers: { "content-type": "application/json" } });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Ontkoppelen mislukt.");
      setSummary((current) => ({ ...current, connected: false, displayName: null, connectedAt: null }));
      setMessage("Canva is ontkoppeld.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Ontkoppelen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-5 shadow-card" aria-labelledby="provider-canva">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="provider-canva" className="font-heading text-heading-sm text-text">Canva</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${chip[state]}`}>{state === "ready" ? "Klaar" : state === "attention" ? "Nog niet gekoppeld" : "Niet ingesteld"}</span>
      </div>
      <p className="mt-3 text-body-sm font-semibold text-text">
        {!summary.configured ? "Geen Canva Connect-integratie ingesteld." : summary.connected ? `Gekoppeld${summary.displayName ? ` als ${summary.displayName}` : ""}.` : "Ingesteld, maar nog geen Canva-account gekoppeld."}
      </p>
      {message ? <p role="status" className="mt-2 rounded-card border border-border bg-background p-2 text-body-sm">{message}</p> : null}
      <details className="mt-3 text-body-sm text-muted" open={!summary.configured}>
        <summary className="cursor-pointer font-semibold text-text">Instellen in het Canva Developer Portal</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Maak een <strong>Connect API</strong>-integratie (geen Apps SDK-app) en kopieer client ID en secret naar <code>CANVA_CLIENT_ID</code> en <code>CANVA_CLIENT_SECRET</code>.</li>
          <li>Redirect-URL: <code className="break-all">{base}{CANVA_CALLBACK_PATH}</code></li>
          <li>Return navigation aan, return-URL: <code className="break-all">{base}{CANVA_RETURN_PATH}</code></li>
          <li>Scopes: <span className="mt-1 flex flex-wrap gap-1">{CANVA_SCOPES.map((scope) => <code key={scope} className="rounded border border-border bg-background px-1 text-xs">{scope}</code>)}</span></li>
        </ol>
      </details>
      {summary.configured ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/api/admin/canva/connect?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast">{summary.connected ? "Opnieuw koppelen" : "Canva koppelen"}</a>
          {summary.connected ? <button type="button" onClick={() => void disconnect()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border px-4 font-heading text-body-sm font-semibold text-text">{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}Ontkoppelen</button> : null}
        </div>
      ) : null}
    </section>
  );
}
