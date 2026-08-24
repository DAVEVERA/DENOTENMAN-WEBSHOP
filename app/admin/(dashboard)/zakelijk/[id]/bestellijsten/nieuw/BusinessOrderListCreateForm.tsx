"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

type Option = { id: string; sku: string; name: string; label: string; priceCents: number };
type Line = Option & { quantity: number; unitPriceEuro: string };

export function BusinessOrderListCreateForm({ accountId, options }: { accountId: string; options: Option[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimumDate = useMemo(() => formatLocalDate(new Date()), []);
  const total = useMemo(() => lines.reduce((sum, line) => sum + Math.round(Number(line.unitPriceEuro) * 100) * line.quantity, 0), [lines]);

  function addSelected() {
    const option = options.find((candidate) => candidate.id === selectedId);
    if (!option || lines.some((line) => line.id === option.id)) return;
    setLines((current) => [...current, { ...option, quantity: 1, unitPriceEuro: (option.priceCents / 100).toFixed(2) }]);
  }

  function patchLine(id: string, patch: Partial<Line>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.length === 0) { setError("Voeg minimaal één productvariant toe."); return; }
    const form = new FormData(event.currentTarget);
    const items = lines.map((line) => ({ variantId: line.id, quantity: line.quantity, unitPriceCents: Math.round(Number(line.unitPriceEuro) * 100) }));
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0)) { setError("Controleer de aantallen en afgesproken prijzen."); return; }
    setBusy(true); setError(null);
    try {
      const validUntil = form.get("validUntil") ? endOfLocalDayIso(String(form.get("validUntil"))) : null;
      const response = await fetch(`/api/admin/business-accounts/${accountId}/order-lists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: String(form.get("title") ?? ""), validUntil, items }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error === "VALID_UNTIL_IN_PAST" ? "Kies vandaag of een latere geldigheidsdatum." : "Bestellijst aanmaken is mislukt. Controleer de invoer en probeer opnieuw.");
        return;
      }
      router.push(`/admin/zakelijk/${accountId}`); router.refresh();
    } catch {
      setError("De verbinding viel weg. Controleer of de lijst is aangemaakt voordat je opnieuw probeert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-body-sm font-semibold text-text">Titel<input name="title" required maxLength={160} placeholder="Bijv. Weekbestelling augustus" className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" /></label>
        <label className="text-body-sm font-semibold text-text">Geldig tot (optioneel)<input name="validUntil" type="date" min={minimumDate} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" /></label>
      </div>
      <div className="rounded-card border border-border bg-background p-3 sm:p-4">
        <label htmlFor="business-product" className="text-body-sm font-semibold text-text">Productvariant toevoegen</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select id="business-product" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-h-12 min-w-0 rounded-button border border-border bg-surface px-3 text-body-sm text-text">
            {options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.label} · {option.sku}</option>)}
          </select>
          <button type="button" onClick={addSelected} className="min-h-12 rounded-button border border-accent bg-surface px-4 font-heading font-bold text-accent-hover">Toevoegen</button>
        </div>
      </div>
      <div className="grid gap-3">
        {lines.map((line) => (
          <article key={line.id} className="rounded-card border border-border p-4">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-heading font-bold text-text">{line.name}</h2><p className="text-body-sm text-muted">{line.label} · {line.sku}</p></div><button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="min-h-11 font-heading text-body-sm font-bold text-red-700 underline">Verwijder</button></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-body-sm font-semibold text-text">Aantal<input type="number" min={1} step={1} value={line.quantity} onChange={(event) => patchLine(line.id, { quantity: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" /></label>
              <label className="text-body-sm font-semibold text-text">Prijs per stuk (€)<input type="number" min={0} step="0.01" value={line.unitPriceEuro} onChange={(event) => patchLine(line.id, { unitPriceEuro: event.target.value })} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" /></label>
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><div><p className="text-body-sm text-muted">Voorsteltotaal</p><p className="font-heading text-heading-sm text-text">{formatPrice(total, "nl")}</p></div><button type="submit" disabled={busy || lines.length === 0} className="min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-50 sm:w-auto">{busy ? "Aanmaken…" : "Bestellijst aanmaken"}</button></div>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfLocalDayIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error("INVALID_DATE");
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}
