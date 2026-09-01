"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

type CatalogOption = { id: string; sku: string; name: string; label: string; priceCents: number };

type Line = {
  key: string;
  variantId: string | null;
  productName: string;
  unit: string;
  sku: string | null;
  quantity: number;
  unitPriceEuro: string;
};

export type ExistingOrderList = {
  id: string;
  version: number;
  status: string;
  title: string;
  validUntil: string | null;
  items: Array<{
    id: string;
    productVariantId: string | null;
    productName: string;
    variantLabel: string | null;
    sku: string | null;
    quantity: number;
    unitPriceCents: number;
  }>;
};

let lineKeySeq = 0;
function nextLineKey(): string {
  lineKeySeq += 1;
  return `line-${lineKeySeq}`;
}

function toCents(euro: string): number {
  return Math.round(Number(euro) * 100);
}

export function BusinessOrderListForm({
  accountId,
  options,
  mode,
  existingList,
}: {
  accountId: string;
  options: CatalogOption[];
  mode: "create" | "edit";
  existingList?: ExistingOrderList;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    (existingList?.items ?? []).map((item) => ({
      key: nextLineKey(),
      variantId: item.productVariantId,
      productName: item.productName,
      unit: item.variantLabel ?? "",
      sku: item.sku,
      quantity: item.quantity,
      unitPriceEuro: (item.unitPriceCents / 100).toFixed(2),
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const minimumDate = useMemo(() => formatLocalDate(new Date()), []);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Math.round(Number(line.unitPriceEuro) * 100) * line.quantity, 0),
    [lines]
  );

  function addFromCatalog() {
    const option = options.find((candidate) => candidate.id === selectedId);
    if (!option) return;
    setLines((current) => [
      ...current,
      {
        key: nextLineKey(),
        variantId: option.id,
        productName: option.name,
        unit: option.label,
        sku: option.sku,
        quantity: 1,
        unitPriceEuro: (option.priceCents / 100).toFixed(2),
      },
    ]);
  }

  function addCustomLine() {
    setLines((current) => [
      ...current,
      { key: nextLineKey(), variantId: null, productName: "", unit: "", sku: null, quantity: 1, unitPriceEuro: "0.00" },
    ]);
  }

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.length === 0) {
      setError("Voeg minimaal één regel toe.");
      return;
    }
    if (lines.some((line) => !line.variantId && line.productName.trim().length === 0)) {
      setError("Vul voor elke eigen regel een productnaam in.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const items = lines.map((line) =>
      line.variantId
        ? { variantId: line.variantId, quantity: line.quantity, unitPriceCents: toCents(line.unitPriceEuro) }
        : {
            productName: line.productName.trim(),
            unit: line.unit.trim() ? line.unit.trim() : null,
            sku: line.sku?.trim() ? line.sku.trim() : null,
            quantity: line.quantity,
            unitPriceCents: toCents(line.unitPriceEuro),
          }
    );
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0)) {
      setError("Controleer de aantallen en prijzen.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const validUntil = form.get("validUntil") ? endOfLocalDayIso(String(form.get("validUntil"))) : null;
      const title = String(form.get("title") ?? "");
      const response = mode === "create"
        ? await fetch(`/api/admin/business-accounts/${accountId}/order-lists`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, validUntil, items }),
          })
        : await fetch(`/api/admin/business-accounts/${accountId}/order-lists/${existingList!.id}/items`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: existingList!.version, title, validUntil, items }),
          });
      const data = (await response.json().catch(() => null)) as { error?: string; wasAlreadySent?: boolean } | null;
      if (!response.ok) {
        setError(errorMessageFor(data?.error));
        return;
      }
      router.push(`/admin/zakelijk/${accountId}`);
      router.refresh();
    } catch {
      setError("De verbinding viel weg. Controleer of de wijziging is verwerkt voordat je opnieuw probeert.");
    } finally {
      setBusy(false);
    }
  }

  async function hardDelete() {
    if (!existingList) return;
    if (!window.confirm("Dit concept definitief verwijderen? Deze actie kan niet ongedaan worden gemaakt.")) return;
    setDangerBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/business-accounts/${accountId}/order-lists/${existingList.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Verwijderen is mislukt. Ververs de pagina en probeer opnieuw.");
        return;
      }
      router.push(`/admin/zakelijk/${accountId}`);
      router.refresh();
    } catch {
      setError("De verbinding viel weg. Ververs de pagina om de huidige status te zien.");
    } finally {
      setDangerBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-6 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-body-sm font-semibold text-text">
          Titel
          <input name="title" required maxLength={160} defaultValue={existingList?.title ?? ""} placeholder="Bijv. Weekbestelling augustus" className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" />
        </label>
        <label className="text-body-sm font-semibold text-text">
          Geldig tot (optioneel)
          <input name="validUntil" type="date" min={minimumDate} defaultValue={existingList?.validUntil ? existingList.validUntil.slice(0, 10) : ""} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" />
        </label>
      </div>

      {options.length > 0 ? (
        <div className="rounded-card border border-dashed border-border bg-background p-3 sm:p-4">
          <label htmlFor="business-product" className="text-body-sm font-semibold text-muted">Optioneel: regel vooraf invullen vanuit assortiment</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select id="business-product" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-h-12 min-w-0 rounded-button border border-border bg-surface px-3 text-body-sm text-text">
              {options.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.label} · {option.sku}</option>)}
            </select>
            <button type="button" onClick={addFromCatalog} className="min-h-12 rounded-button border border-accent bg-surface px-4 font-heading font-bold text-accent-hover">Toevoegen</button>
          </div>
        </div>
      ) : null}

      <button type="button" onClick={addCustomLine} className="min-h-12 w-full rounded-button border border-accent bg-surface px-4 font-heading font-bold text-accent-hover sm:w-auto">
        + Eigen regel toevoegen
      </button>

      <div className="grid gap-3">
        {lines.map((line) => (
          <article key={line.key} className="rounded-card border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              {line.variantId ? (
                <div>
                  <h2 className="font-heading font-bold text-text">{line.productName}</h2>
                  <p className="text-body-sm text-muted">{line.unit} · {line.sku}</p>
                </div>
              ) : (
                <input
                  aria-label="Productnaam"
                  required
                  value={line.productName}
                  onChange={(event) => patchLine(line.key, { productName: event.target.value })}
                  placeholder="Bijv. Cashewnoten naturel"
                  className="min-w-0 flex-1 rounded-button border border-border bg-background px-3 py-2 font-heading font-bold text-text"
                />
              )}
              <button type="button" onClick={() => removeLine(line.key)} className="min-h-11 shrink-0 font-heading text-body-sm font-bold text-red-700 underline">Verwijder</button>
            </div>
            <div className={`mt-3 grid gap-3 ${line.variantId ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
              {!line.variantId ? (
                <label className="text-body-sm font-semibold text-text">
                  Eenheid
                  <input list="business-unit-suggestions" value={line.unit} onChange={(event) => patchLine(line.key, { unit: event.target.value })} placeholder="stuk, kg, doos…" className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" />
                </label>
              ) : null}
              <label className="text-body-sm font-semibold text-text">
                Aantal
                <input type="number" min={1} step={1} value={line.quantity} onChange={(event) => patchLine(line.key, { quantity: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" />
              </label>
              <label className="text-body-sm font-semibold text-text">
                Prijs per eenheid (€)
                <input type="number" min={0} step="0.01" value={line.unitPriceEuro} onChange={(event) => patchLine(line.key, { unitPriceEuro: event.target.value })} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3" />
              </label>
            </div>
          </article>
        ))}
        <datalist id="business-unit-suggestions">
          <option value="stuk" /><option value="kg" /><option value="doos" /><option value="krat" /><option value="zak" />
        </datalist>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div><p className="text-body-sm text-muted">{mode === "create" ? "Voorsteltotaal" : "Totaal"}</p><p className="font-heading text-heading-sm text-text">{formatPrice(total, "nl")}</p></div>
        <button type="submit" disabled={busy || lines.length === 0} className="min-h-12 w-full rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-50 sm:w-auto">
          {mode === "create" ? (busy ? "Aanmaken…" : "Bestellijst aanmaken") : busy ? "Opslaan…" : "Wijzigingen opslaan"}
        </button>
      </div>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}

      {mode === "edit" && existingList && existingList.status === "DRAFT" ? (
        <div className="mt-2 rounded-card border border-red-200 bg-red-50/50 p-4">
          <p className="text-body-sm font-semibold text-red-900">Concept verwijderen</p>
          <p className="mt-1 text-body-sm text-red-800">Dit concept is nog nooit naar de klant verstuurd. Verwijderen kan niet ongedaan worden gemaakt.</p>
          <button type="button" disabled={dangerBusy} onClick={hardDelete} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-button border border-red-600 bg-red-600 px-4 font-heading text-body-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
            {dangerBusy ? "Bezig…" : "Concept definitief verwijderen"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "VALID_UNTIL_IN_PAST":
      return "Kies vandaag of een latere geldigheidsdatum.";
    case "VERSION_CONFLICT":
      return "Deze lijst is intussen elders gewijzigd. Ververs de pagina en probeer opnieuw.";
    case "CHECKOUT_IN_PROGRESS":
      return "De klant is nu aan het afrekenen. Wacht tot de betaling is afgerond voordat je deze lijst wijzigt.";
    case "INVALID_STATUS_TRANSITION":
      return "Deze lijst kan niet meer worden bewerkt (bijvoorbeeld omdat hij al betaald of geannuleerd is).";
    case "VARIANT_NOT_AVAILABLE":
      return "Eén van de gekozen producten is niet meer beschikbaar.";
    case "ACCOUNT_NOT_APPROVED":
      return "Keur dit account eerst goed.";
    default:
      return "Opslaan is mislukt. Controleer de invoer en probeer opnieuw.";
  }
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
