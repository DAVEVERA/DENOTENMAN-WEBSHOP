"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Config = { status: string; headlines: string[]; descriptions: string[]; finalUrl: string; dailyBudgetMicros: number; published: boolean; lastError: string | null };
const field = "mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 py-2 text-body-sm";

export function GoogleAdsEditor({ productId, initial, configured }: { productId: string; initial: Config; configured: boolean }) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  function setList(key: "headlines" | "descriptions", index: number, value: string) { const next = [...config[key]]; next[index] = value; setConfig({ ...config, [key]: next }); }
  async function request(body: object) {
    setState("saving"); setMessage(null);
    const response = await fetch("/api/admin/google-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, ...body }) });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setState(response.ok ? "idle" : "error");
    setMessage(response.ok ? "Google Ads-instellingen zijn verwerkt." : data?.error === "GOOGLE_ADS_CONFIG_MISSING" ? "De Google Ads-credentials ontbreken nog; het concept is wel veilig opgeslagen." : "De Google Ads-actie is niet gelukt.");
    if (response.ok) router.refresh();
  }
  async function save(event: React.FormEvent) { event.preventDefault(); await request({ action: "save", headlines: config.headlines, descriptions: config.descriptions, finalUrl: config.finalUrl, dailyBudgetMicros: config.dailyBudgetMicros }); }
  async function external(action: "publish" | "enable" | "pause") {
    const text = action === "enable" ? "Deze advertentie echt inschakelen en budget laten gebruiken?" : action === "publish" ? "Dit concept als gepauzeerde advertentie naar Google Ads sturen?" : "Deze advertentie in Google Ads pauzeren?";
    if (confirm(text)) await request({ action });
  }
  return <form onSubmit={save} className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-heading-md">Advertentieconcept</h2><span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">Status: {config.status}</span></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="space-y-3">{[0,1,2].map((index) => <label key={index} className="block text-body-sm font-semibold">Kop {index + 1} <span className="font-normal text-muted">({config.headlines[index]?.length ?? 0}/30)</span><input maxLength={30} value={config.headlines[index] ?? ""} onChange={(event) => setList("headlines", index, event.target.value)} className={field} required /></label>)}</div><div className="space-y-3">{[0,1].map((index) => <label key={index} className="block text-body-sm font-semibold">Beschrijving {index + 1} <span className="font-normal text-muted">({config.descriptions[index]?.length ?? 0}/90)</span><textarea maxLength={90} value={config.descriptions[index] ?? ""} onChange={(event) => setList("descriptions", index, event.target.value)} rows={3} className={field} required /></label>)}</div><label className="block text-body-sm font-semibold">Bestemmings-URL<input type="url" value={config.finalUrl} onChange={(event) => setConfig({ ...config, finalUrl: event.target.value })} className={field} required /></label><label className="block text-body-sm font-semibold">Dagbudget (€)<input type="number" min="1" max="2000" step="0.01" value={(config.dailyBudgetMicros / 1_000_000).toFixed(2)} onChange={(event) => setConfig({ ...config, dailyBudgetMicros: Math.round(Number(event.target.value) * 1_000_000) })} className={field} required /></label></div>
    {config.lastError ? <p className="mt-4 rounded-card bg-red-50 p-3 text-body-sm text-red-700">Laatste API-fout: {config.lastError}</p> : null}
    {message ? <p className={`mt-4 text-body-sm ${state === "error" ? "text-red-700" : "text-green-700"}`} role="status">{message}</p> : null}
    <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap"><button type="submit" disabled={state === "saving"} className="min-h-12 rounded-button bg-accent px-5 font-bold text-contrast">Concept opslaan</button><button type="button" disabled={!configured || config.published || state === "saving"} onClick={() => external("publish")} className="min-h-12 rounded-button border border-border px-5 font-semibold disabled:opacity-40">Gepauzeerd publiceren</button><button type="button" disabled={!configured || !config.published || state === "saving"} onClick={() => external("enable")} className="min-h-12 rounded-button border border-green-300 px-5 font-semibold text-green-800 disabled:opacity-40">Inschakelen</button><button type="button" disabled={!configured || !config.published || state === "saving"} onClick={() => external("pause")} className="min-h-12 rounded-button border border-red-200 px-5 font-semibold text-red-700 disabled:opacity-40">Pauzeren</button></div>
  </form>;
}

export function GoogleAdsGroupDrafts({ categories }: { categories: { id: string; name: string }[] }) {
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function apply(action: "create-drafts" | "enable" | "pause") {
    const question = action === "create-drafts" ? "Advertentieconcepten aanmaken voor alle actieve producten in deze groep? Er wordt nog niets gepubliceerd." : action === "enable" ? "Alle reeds gepubliceerde advertenties in deze groep inschakelen? Dit kan budget gebruiken." : "Alle reeds gepubliceerde advertenties in deze groep pauzeren?";
    if (!categoryId || !confirm(question)) return;
    const response = await fetch("/api/admin/google-ads/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId, action }) });
    const body = await response.json().catch(() => null) as { count?: number; failed?: number; error?: string } | null;
    setMessage(response.ok ? `${body?.count ?? 0} productadvertenties verwerkt${body?.failed ? `, ${body.failed} mislukt` : ""}.` : body?.error === "GOOGLE_ADS_CONFIG_MISSING" ? "Google Ads-credentials ontbreken; externe groepsactie is geblokkeerd." : "Groepsactie is niet gelukt.");
  }
  return <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md">Productgroep</h2><p className="mt-1 text-body-sm text-muted">Maak concepten of beheer de status van reeds gepubliceerde advertenties per categorie.</p><div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="min-h-12 min-w-0 rounded-button border border-border px-3"><option value="">Kies een categorie</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" onClick={() => apply("create-drafts")} className="min-h-12 rounded-button border border-accent px-4 font-semibold">Concepten</button><button type="button" onClick={() => apply("enable")} className="min-h-12 rounded-button border border-green-300 px-4 font-semibold text-green-800">Inschakelen</button><button type="button" onClick={() => apply("pause")} className="min-h-12 rounded-button border border-red-200 px-4 font-semibold text-red-700">Pauzeren</button></div>{message ? <p className="mt-3 text-body-sm" role="status">{message}</p> : null}</section>;
}
