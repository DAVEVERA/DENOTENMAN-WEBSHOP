"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { CLOUD_COST_PERIODS, type CloudCostPeriod, type CloudCostsReport } from "@/lib/cloud-costs";
import { cn } from "@/lib/cn";

type LoadingState = "loading" | "ready" | "error";
type Provider = "PHOTOROOM" | "PRISMA" | "OTHER";
type CostCategory = "SOFTWARE" | "INFRASTRUCTURE" | "MARKETING" | "OTHER";
type CostRecurrence = "ONE_TIME" | "MONTHLY" | "YEARLY";

type ManagedCost = {
  id: string;
  provider: Provider;
  providerName: string;
  category: CostCategory;
  description: string | null;
  amountCents: number | null;
  currency: string;
  recurrence: CostRecurrence;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  version: number;
};

type CostInvoice = {
  id: string;
  managedCostId: string | null;
  provider: Provider | null;
  providerName: string | null;
  category: CostCategory | null;
  amountCents: number | null;
  currency: string;
  issuedAt: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  notes: string | null;
  version: number;
  downloadUrl: string;
};

type CostFormValue = {
  provider: Provider;
  providerName: string;
  category: CostCategory;
  amount: string;
  currency: string;
  recurrence: CostRecurrence;
  startsAt: string;
  endsAt: string;
  description: string;
  active: boolean;
};

const inputClass =
  "min-h-11 w-full min-w-0 rounded-button border border-border bg-surface px-3 py-2 text-body-sm text-text disabled:bg-background disabled:text-muted";
const labelClass = "grid min-w-0 gap-1.5 text-body-sm font-semibold text-text";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 text-body-sm font-semibold text-text transition-colors hover:border-border-hover disabled:cursor-wait disabled:opacity-60";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-4 text-body-sm font-bold text-contrast shadow-button transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60";

const cloudErrorMessages: Record<string, string> = {
  BILLING_EXPORT_NOT_CONFIGURED: "De Cloud Billing-export moet nog aan een BigQuery-dataset worden gekoppeld.",
  BILLING_EXPORT_FORBIDDEN: "Het webshopaccount heeft nog geen leesrechten op de factureringsdataset.",
  BILLING_EXPORT_UNAVAILABLE: "De factureringsdata is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
  INVALID_CONFIGURATION: "De configuratie van de factureringsbronnen bevat een ongeldige waarde.",
};

const providerLabels: Record<Provider, string> = {
  PHOTOROOM: "PhotoRoom",
  PRISMA: "Prisma",
  OTHER: "Overig",
};
const categoryLabels: Record<CostCategory, string> = {
  SOFTWARE: "Software",
  INFRASTRUCTURE: "Infrastructuur",
  MARKETING: "Marketing",
  OTHER: "Overig",
};
const recurrenceLabels: Record<CostRecurrence, string> = {
  ONE_TIME: "Eenmalig",
  MONTHLY: "Maandelijks",
  YEARLY: "Jaarlijks",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = (await response.json()) as unknown;
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function apiError(body: Record<string, unknown>, fallback: string) {
  const code = typeof body.error === "string" ? body.error : "";
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return "Je sessie geeft geen toegang tot dit kostenoverzicht. Log zo nodig opnieuw in.";
  if (code === "STALE_VERSION" || code === "VERSION_CONFLICT") return "Dit item is intussen gewijzigd. Vernieuw de lijst en probeer het opnieuw.";
  if (code === "INVOICE_TOO_LARGE") return "Het factuurbestand is te groot. Kies een kleiner bestand.";
  if (code === "INVALID_INVOICE" || code === "VALIDATION_ERROR") return "Controleer de ingevulde gegevens en het gekozen bestand.";
  return fallback;
}

function normalizeCost(value: unknown): ManagedCost | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.providerName !== "string") return null;
  if (value.provider !== "PHOTOROOM" && value.provider !== "PRISMA" && value.provider !== "OTHER") return null;
  if (value.category !== "SOFTWARE" && value.category !== "INFRASTRUCTURE" && value.category !== "MARKETING" && value.category !== "OTHER") return null;
  if (value.recurrence !== "ONE_TIME" && value.recurrence !== "MONTHLY" && value.recurrence !== "YEARLY") return null;
  return {
    id: value.id,
    provider: value.provider,
    providerName: value.providerName,
    category: value.category,
    description: typeof value.description === "string" ? value.description : null,
    amountCents: typeof value.amountCents === "number" ? value.amountCents : null,
    currency: typeof value.currency === "string" ? value.currency : "EUR",
    recurrence: value.recurrence,
    startsAt: typeof value.startsAt === "string" ? value.startsAt : null,
    endsAt: typeof value.endsAt === "string" ? value.endsAt : null,
    active: value.active !== false,
    version: typeof value.version === "number" ? value.version : 1,
  };
}

function normalizeInvoice(value: unknown): CostInvoice | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const provider = value.provider === "PHOTOROOM" || value.provider === "PRISMA" || value.provider === "OTHER" ? value.provider : null;
  const category = value.category === "SOFTWARE" || value.category === "INFRASTRUCTURE" || value.category === "MARKETING" || value.category === "OTHER" ? value.category : null;
  return {
    id: value.id,
    managedCostId: typeof value.managedCostId === "string" ? value.managedCostId : null,
    provider,
    providerName: typeof value.providerName === "string" ? value.providerName : null,
    category,
    amountCents: typeof value.amountCents === "number" ? value.amountCents : null,
    currency: typeof value.currency === "string" ? value.currency : "EUR",
    issuedAt: typeof value.issuedAt === "string" ? value.issuedAt : "",
    billingPeriodStart: typeof value.billingPeriodStart === "string" ? value.billingPeriodStart : null,
    billingPeriodEnd: typeof value.billingPeriodEnd === "string" ? value.billingPeriodEnd : null,
    originalFilename: typeof value.originalFilename === "string" ? value.originalFilename : "Factuurbestand",
    contentType: typeof value.contentType === "string" ? value.contentType : "",
    fileSize: typeof value.fileSize === "number" ? value.fileSize : 0,
    notes: typeof value.notes === "string" ? value.notes : null,
    version: typeof value.version === "number" ? value.version : 1,
    downloadUrl: typeof value.downloadUrl === "string" ? value.downloadUrl : `/api/admin/cost-overview/invoices/${value.id}/download`,
  };
}

export function formatCloudCostMoney(value: number | null | undefined, currency = "EUR") {
  if (value === undefined || value === null) return "Niet beschikbaar";
  const displayValue = Math.abs(value) < 0.00005 ? 0 : value;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(displayValue);
}

export function formatManagedCostMoney(value: number | null | undefined, currency = "EUR") {
  if (value === undefined || value === null) return "Bedrag nog vastleggen";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(value / 100);
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value));
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toIso(value: FormDataEntryValue | string | null) {
  return typeof value === "string" && value ? new Date(`${value}T12:00:00.000Z`).toISOString() : null;
}

function amountToCents(value: string) {
  if (!value.trim()) return null;
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function mutationHeaders(prefix: string, json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "Idempotency-Key": `${prefix}:${crypto.randomUUID()}`,
  };
}

function defaultCostForm(cost?: ManagedCost): CostFormValue {
  return {
    provider: cost?.provider ?? "OTHER",
    providerName: cost?.providerName ?? "",
    category: cost?.category ?? "SOFTWARE",
    amount: cost?.amountCents === null || cost?.amountCents === undefined ? "" : String(cost.amountCents / 100),
    currency: cost?.currency ?? "EUR",
    recurrence: cost?.recurrence ?? "MONTHLY",
    startsAt: toDateInput(cost?.startsAt ?? null),
    endsAt: toDateInput(cost?.endsAt ?? null),
    description: cost?.description ?? "",
    active: cost?.active ?? true,
  };
}

function CostEditor({ cost, busy, onCancel, onSubmit }: { cost?: ManagedCost; busy: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, value: CostFormValue) => void }) {
  const [value, setValue] = useState(() => defaultCostForm(cost));
  return (
    <form onSubmit={(event) => onSubmit(event, value)} className="mt-5 rounded-panel border border-border bg-background p-4 sm:p-5" aria-label={cost ? `${cost.providerName} bewerken` : "Kostenpost toevoegen"}>
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-heading-sm">{cost ? "Kostenpost bewerken" : "Nieuwe kostenpost"}</h3><p className="mt-1 text-body-sm text-muted">Laat het bedrag leeg zolang het nog niet bekend is.</p></div><button type="button" onClick={onCancel} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button hover:bg-surface" aria-label="Formulier sluiten"><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>Leverancier<select className={inputClass} value={value.provider} onChange={(event) => { const provider = event.target.value as Provider; setValue((current) => ({ ...current, provider, providerName: provider === "OTHER" ? "" : providerLabels[provider] })); }}><option value="PHOTOROOM">PhotoRoom</option><option value="PRISMA">Prisma</option><option value="OTHER">Overig</option></select></label>
        <label className={labelClass}>Naam<input className={inputClass} value={value.providerName} maxLength={120} required onChange={(event) => setValue((current) => ({ ...current, providerName: event.target.value }))} /></label>
        <label className={labelClass}>Categorie<select className={inputClass} value={value.category} onChange={(event) => setValue((current) => ({ ...current, category: event.target.value as CostCategory }))}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={labelClass}>Bedrag <span className="font-normal text-muted">(optioneel)</span><input className={inputClass} type="number" inputMode="decimal" min="0" step="0.01" value={value.amount} onChange={(event) => setValue((current) => ({ ...current, amount: event.target.value }))} /></label>
        <label className={labelClass}>Valuta<input className={inputClass} value={value.currency} minLength={3} maxLength={3} pattern="[A-Za-z]{3}" required onChange={(event) => setValue((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
        <label className={labelClass}>Herhaling<select className={inputClass} value={value.recurrence} onChange={(event) => setValue((current) => ({ ...current, recurrence: event.target.value as CostRecurrence }))}>{Object.entries(recurrenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={labelClass}>Startdatum<input className={inputClass} type="date" value={value.startsAt} onChange={(event) => setValue((current) => ({ ...current, startsAt: event.target.value }))} /></label>
        <label className={labelClass}>Einddatum<input className={inputClass} type="date" min={value.startsAt || undefined} value={value.endsAt} onChange={(event) => setValue((current) => ({ ...current, endsAt: event.target.value }))} /></label>
        <label className="flex min-h-11 items-center gap-3 self-end text-body-sm font-semibold"><input type="checkbox" checked={value.active} onChange={(event) => setValue((current) => ({ ...current, active: event.target.checked }))} className="h-5 w-5 accent-[var(--color-accent-ink)]" />Actieve kostenpost</label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Notitie<textarea className={`${inputClass} min-h-24 resize-y`} maxLength={500} value={value.description} onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))} /></label>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className={secondaryButtonClass}>Annuleren</button><button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Opslaan…" : "Kostenpost opslaan"}</button></div>
    </form>
  );
}

function InvoiceUploader({ costs, busy, onCancel, onSubmit }: { costs: ManagedCost[]; busy: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [managedCostId, setManagedCostId] = useState("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [category, setCategory] = useState<CostCategory | "">("");

  return (
    <form onSubmit={onSubmit} className="mt-5 rounded-panel border border-border bg-background p-4 sm:p-5" aria-label="Factuur uploaden">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-heading-sm">Factuur toevoegen</h3><p className="mt-1 text-body-sm text-muted">Pdf, jpg, png, webp of avif.</p></div><button type="button" onClick={onCancel} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button hover:bg-surface" aria-label="Formulier sluiten"><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Factuurbestand<input className={`${inputClass} file:mr-3 file:rounded-button file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-contrast`} type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" required /></label>
        <label className={labelClass}>Kostenpost<select className={inputClass} name="managedCostId" value={managedCostId} onChange={(event) => { const id = event.target.value; const linked = costs.find((cost) => cost.id === id); setManagedCostId(id); if (linked) { setProvider(linked.provider); setCategory(linked.category); } }}><option value="">Niet gekoppeld</option>{costs.map((cost) => <option key={cost.id} value={cost.id}>{cost.providerName}</option>)}</select></label>
        <label className={labelClass}>Leverancier<select className={inputClass} name="provider" value={provider} required onChange={(event) => setProvider(event.target.value as Provider)}><option value="" disabled>Kies een leverancier</option>{Object.entries(providerLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={labelClass}>Categorie<select className={inputClass} name="category" value={category} required onChange={(event) => setCategory(event.target.value as CostCategory)}><option value="" disabled>Kies een categorie</option>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={labelClass}>Factuurdatum<input className={inputClass} type="date" name="issuedAt" required /></label>
        <label className={labelClass}>Bedrag <span className="font-normal text-muted">(optioneel)</span><input className={inputClass} type="number" inputMode="decimal" min="0" step="0.01" name="amount" /></label>
        <label className={labelClass}>Valuta<input className={inputClass} name="currency" defaultValue="EUR" minLength={3} maxLength={3} pattern="[A-Za-z]{3}" required /></label>
        <label className={labelClass}>Periode vanaf<input className={inputClass} type="date" name="billingPeriodStart" /></label>
        <label className={labelClass}>Periode tot<input className={inputClass} type="date" name="billingPeriodEnd" /></label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Notitie<textarea className={`${inputClass} min-h-24 resize-y`} name="notes" maxLength={500} /></label>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className={secondaryButtonClass}>Annuleren</button><button type="submit" disabled={busy} className={primaryButtonClass}><Upload className="h-4 w-4" aria-hidden="true" />{busy ? "Uploaden…" : "Factuur uploaden"}</button></div>
    </form>
  );
}

export function CloudCostsDashboard() {
  const [days, setDays] = useState<CloudCostPeriod>(30);
  const [cloudState, setCloudState] = useState<LoadingState>("loading");
  const [report, setReport] = useState<CloudCostsReport | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [costsState, setCostsState] = useState<LoadingState>("loading");
  const [costs, setCosts] = useState<ManagedCost[]>([]);
  const [costsCanManage, setCostsCanManage] = useState(false);
  const [costsError, setCostsError] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<ManagedCost | "new" | null>(null);
  const [costBusy, setCostBusy] = useState(false);
  const [costMessage, setCostMessage] = useState<string | null>(null);
  const [costMessageIsError, setCostMessageIsError] = useState(false);
  const [invoicesState, setInvoicesState] = useState<LoadingState>("loading");
  const [invoices, setInvoices] = useState<CostInvoice[]>([]);
  const [invoicesCanManage, setInvoicesCanManage] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);
  const [invoiceMessageIsError, setInvoiceMessageIsError] = useState(false);

  const loadCloud = useCallback(async (period: CloudCostPeriod, signal?: AbortSignal) => {
    setCloudState("loading"); setCloudError(null);
    try {
      const response = await fetch(`/api/admin/cloud-costs?days=${period}`, { cache: "no-store", signal });
      const body = (await response.json()) as CloudCostsReport | { error?: string };
      if (!response.ok || !("summary" in body)) throw new Error("error" in body && body.error ? body.error : "BILLING_EXPORT_UNAVAILABLE");
      setReport(body); setCloudState("ready");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const code = cause instanceof Error ? cause.message : "BILLING_EXPORT_UNAVAILABLE";
      setCloudError(cloudErrorMessages[code] ?? cloudErrorMessages.BILLING_EXPORT_UNAVAILABLE); setCloudState("error");
    }
  }, []);

  const loadCosts = useCallback(async (signal?: AbortSignal) => {
    setCostsState("loading"); setCostsError(null);
    try {
      const response = await fetch("/api/admin/cost-overview/costs", { cache: "no-store", signal });
      const body = await readJson(response);
      if (!response.ok) throw new Error(apiError(body, "De beheerkosten konden niet worden opgehaald."));
      setCosts((Array.isArray(body.costs) ? body.costs : []).map(normalizeCost).filter((item): item is ManagedCost => item !== null));
      setCostsCanManage(body.canManage === true); setCostsState("ready");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setCostsCanManage(false); setCostsError(cause instanceof Error ? cause.message : "De beheerkosten konden niet worden opgehaald."); setCostsState("error");
    }
  }, []);

  const loadInvoices = useCallback(async (signal?: AbortSignal) => {
    setInvoicesState("loading"); setInvoicesError(null);
    try {
      const response = await fetch("/api/admin/cost-overview/invoices", { cache: "no-store", signal });
      const body = await readJson(response);
      if (!response.ok) throw new Error(apiError(body, "De facturen konden niet worden opgehaald."));
      setInvoices((Array.isArray(body.invoices) ? body.invoices : []).map(normalizeInvoice).filter((item): item is CostInvoice => item !== null));
      setInvoicesCanManage(body.canManage === true); setInvoicesState("ready");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setInvoicesCanManage(false); setInvoicesError(cause instanceof Error ? cause.message : "De facturen konden niet worden opgehaald."); setInvoicesState("error");
    }
  }, []);

  useEffect(() => { const controller = new AbortController(); void loadCloud(days, controller.signal); return () => controller.abort(); }, [days, loadCloud]);
  useEffect(() => { const controller = new AbortController(); void Promise.all([loadCosts(controller.signal), loadInvoices(controller.signal)]); return () => controller.abort(); }, [loadCosts, loadInvoices]);

  const maximumDailyCost = useMemo(() => Math.max(0.01, ...(report?.daily.map((item) => Math.max(0, item.netCost)) ?? [])), [report]);
  const currency = report?.currency ?? "EUR";
  const providerSummaries = useMemo(() => (["PHOTOROOM", "PRISMA", "OTHER"] as const).map((provider) => {
    const matching = costs.filter((cost) => cost.provider === provider && cost.active && cost.recurrence !== "ONE_TIME" && cost.currency === "EUR");
    const known = matching.filter((cost) => cost.amountCents !== null);
    return { provider, count: costs.filter((cost) => cost.provider === provider && cost.active).length, monthlyCents: known.length ? known.reduce((sum, cost) => sum + (cost.recurrence === "YEARLY" ? (cost.amountCents ?? 0) / 12 : cost.amountCents ?? 0), 0) : null };
  }), [costs]);

  async function saveCost(event: FormEvent<HTMLFormElement>, value: CostFormValue) {
    event.preventDefault(); if (!costsCanManage || costBusy) return;
    const existing = editingCost === "new" ? undefined : editingCost ?? undefined;
    const payload = { provider: value.provider, providerName: value.providerName.trim(), category: value.category, description: value.description.trim() || null, amountCents: amountToCents(value.amount), currency: value.currency.toUpperCase(), recurrence: value.recurrence, startsAt: toIso(value.startsAt), endsAt: toIso(value.endsAt), active: value.active, ...(existing ? { expectedVersion: existing.version } : {}) };
    setCostBusy(true); setCostMessage(null); setCostMessageIsError(false);
    try {
      const response = await fetch(existing ? `/api/admin/cost-overview/costs/${encodeURIComponent(existing.id)}` : "/api/admin/cost-overview/costs", { method: existing ? "PATCH" : "POST", headers: mutationHeaders("managed-cost", true), body: JSON.stringify(payload) });
      const body = await readJson(response); if (!response.ok) throw new Error(apiError(body, "De kostenpost kon niet worden opgeslagen."));
      setEditingCost(null); setCostMessage(existing ? "Kostenpost bijgewerkt." : "Kostenpost toegevoegd."); await loadCosts();
    } catch (cause) { setCostMessage(cause instanceof Error ? cause.message : "De kostenpost kon niet worden opgeslagen."); setCostMessageIsError(true); } finally { setCostBusy(false); }
  }

  async function deleteCost(cost: ManagedCost) {
    if (!costsCanManage || costBusy || !window.confirm(`Kostenpost ‘${cost.providerName}’ verwijderen?`)) return;
    setCostBusy(true); setCostMessage(null); setCostMessageIsError(false);
    try {
      const response = await fetch(`/api/admin/cost-overview/costs/${encodeURIComponent(cost.id)}`, { method: "DELETE", headers: mutationHeaders("managed-cost-delete", true), body: JSON.stringify({ expectedVersion: cost.version }) });
      const body = await readJson(response); if (!response.ok) throw new Error(apiError(body, "De kostenpost kon niet worden verwijderd."));
      setCostMessage("Kostenpost verwijderd."); await loadCosts();
    } catch (cause) { setCostMessage(cause instanceof Error ? cause.message : "De kostenpost kon niet worden verwijderd."); setCostMessageIsError(true); } finally { setCostBusy(false); }
  }

  async function uploadInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!invoicesCanManage || invoiceBusy) return;
    const form = event.currentTarget; const data = new FormData(form);
    data.set("issuedAt", toIso(data.get("issuedAt")) ?? "");
    const periodStart = toIso(data.get("billingPeriodStart")); const periodEnd = toIso(data.get("billingPeriodEnd"));
    if (periodStart) data.set("billingPeriodStart", periodStart); else data.delete("billingPeriodStart");
    if (periodEnd) data.set("billingPeriodEnd", periodEnd); else data.delete("billingPeriodEnd");
    const amount = data.get("amount"); if (typeof amount === "string" && amount) data.set("amountCents", String(amountToCents(amount))); data.delete("amount");
    if (!data.get("managedCostId")) data.delete("managedCostId");
    setInvoiceBusy(true); setInvoiceMessage(null); setInvoiceMessageIsError(false);
    try {
      const response = await fetch("/api/admin/cost-overview/invoices", { method: "POST", headers: mutationHeaders("cost-invoice"), body: data });
      const body = await readJson(response); if (!response.ok) throw new Error(apiError(body, "De factuur kon niet worden geüpload."));
      form.reset(); setUploadOpen(false); setInvoiceMessage("Factuur toegevoegd."); await loadInvoices();
    } catch (cause) { setInvoiceMessage(cause instanceof Error ? cause.message : "De factuur kon niet worden geüpload."); setInvoiceMessageIsError(true); } finally { setInvoiceBusy(false); }
  }

  async function deleteInvoice(invoice: CostInvoice) {
    if (!invoicesCanManage || invoiceBusy || !window.confirm(`Factuur ‘${invoice.originalFilename}’ verwijderen?`)) return;
    setInvoiceBusy(true); setInvoiceMessage(null); setInvoiceMessageIsError(false);
    try {
      const response = await fetch(`/api/admin/cost-overview/invoices/${encodeURIComponent(invoice.id)}`, { method: "DELETE", headers: mutationHeaders("cost-invoice-delete", true), body: JSON.stringify({ expectedVersion: invoice.version }) });
      const body = await readJson(response); if (!response.ok) throw new Error(apiError(body, "De factuur kon niet worden verwijderd."));
      setInvoiceMessage("Factuur verwijderd."); await loadInvoices();
    } catch (cause) { setInvoiceMessage(cause instanceof Error ? cause.message : "De factuur kon niet worden verwijderd."); setInvoiceMessageIsError(true); } finally { setInvoiceBusy(false); }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Financieel beheer</p><h1 className="mt-1 text-[clamp(2rem,10vw,2.75rem)] leading-tight">Kostenoverzicht</h1><p className="mt-2 max-w-3xl text-body-sm text-muted">Werkelijke Google Cloud-kosten, beheerde diensten en bijbehorende facturen op één plek.</p></div>
        <div className="inline-flex w-full rounded-button border border-border bg-surface p-1 lg:w-auto" aria-label="Kostenperiode">{CLOUD_COST_PERIODS.map((period) => <button key={period} type="button" onClick={() => setDays(period)} aria-pressed={days === period} className={cn("min-h-11 min-w-0 flex-1 rounded-button px-2 text-body-sm font-semibold sm:px-3 lg:flex-none", days === period ? "bg-accent text-contrast" : "hover:bg-background")}>{period} dagen</button>)}</div>
      </div>

      <div aria-live="polite">{cloudState === "error" ? <div className="rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-950"><p className="font-heading font-bold">Google Cloud-kosten niet beschikbaar</p><p className="mt-1">{cloudError}</p><button type="button" onClick={() => void loadCloud(days)} className="mt-3 min-h-11 rounded-button border border-amber-500 px-4 font-semibold">Opnieuw controleren</button></div> : cloudState === "loading" ? <p className="text-body-sm text-muted">Kosten worden opgehaald…</p> : report?.latestUsageAt ? <p className="text-body-sm text-muted">Laatste verwerkte kostenregel: {formatDateTime(report.latestUsageAt)}. Billingdata loopt niet realtime binnen.</p> : <p className="text-body-sm text-muted">Voor deze periode zijn geen kostenregels gevonden.</p>}</div>

      <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-card" aria-labelledby="nutty-bill-heading"><div className="grid min-h-52 md:grid-cols-[minmax(0,1fr)_9rem]"><div className="flex min-w-0 flex-col justify-between p-5 sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">Google Cloud Billing</p><h2 id="nutty-bill-heading" className="mt-2 text-heading-lg">the nutty bill</h2></div><div className="mt-8 min-w-0"><p className="text-body-sm text-muted">Werkelijk gefactureerd</p><p className="mt-1 break-words font-heading text-[clamp(2rem,11vw,4.75rem)] font-bold leading-none tracking-tight">{formatCloudCostMoney(report?.summary.netCost, currency)}</p><p className="mt-3 text-xs text-muted">Totaal over de laatste {days} dagen</p></div></div><div className="hidden bg-[linear-gradient(145deg,var(--color-accent)_0_46%,transparent_46%_54%,var(--color-text)_54%_100%)] opacity-90 md:block" aria-hidden="true" /></div></section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="daily-costs-heading"><div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><h2 id="daily-costs-heading" className="text-heading-md">Dagelijks verloop</h2><span className="text-xs text-muted">Werkelijk gefactureerd per dag</span></div><div className="mt-6 flex h-52 min-w-0 items-end gap-px sm:gap-1" role="img" aria-label={`Werkelijk gefactureerde Google Cloud-kosten per dag over ${days} dagen`}>{(report?.daily ?? Array.from({ length: days }, (_, index) => ({ date: String(index), netCost: 0 }))).map((item) => { const height = report ? Math.max(2, (Math.max(0, item.netCost) / maximumDailyCost) * 100) : 2; return <div key={item.date} className="flex h-full min-w-0 flex-1 items-end"><div className={cn("w-full rounded-t-sm", report ? "bg-accent" : "animate-pulse bg-border")} style={{ height: `${height}%` }} title={report ? `${formatChartDate(item.date)}: ${formatCloudCostMoney(item.netCost, currency)}` : undefined} /></div>; })}</div>{report?.daily.length ? <div className="mt-2 flex justify-between text-xs text-muted"><span>{formatChartDate(report.daily[0].date)}</span><span>{formatChartDate(report.daily[report.daily.length - 1].date)}</span></div> : null}</section>
        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="service-costs-heading"><h2 id="service-costs-heading" className="text-heading-md">Kosten per dienst</h2><div className="mt-4 grid gap-2 sm:hidden">{report?.services.map((service) => <div key={service.id} className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3 last:border-0"><span className="min-w-0 break-words font-semibold">{service.name}</span><span className="shrink-0 font-semibold">{formatCloudCostMoney(service.netCost, currency)}</span></div>)}{cloudState === "ready" && report?.services.length === 0 ? <p className="py-6 text-center text-body-sm text-muted">Geen kostenregels in deze periode.</p> : null}</div><table className="mt-4 hidden w-full text-body-sm sm:table"><thead><tr className="border-b border-border text-left text-muted"><th scope="col" className="py-3 pr-3">Dienst</th><th scope="col" className="py-3 pl-2 text-right">Werkelijke kosten</th></tr></thead><tbody>{report?.services.map((service) => <tr key={service.id} className="border-b border-border last:border-0"><td className="py-3 pr-3 font-semibold">{service.name}</td><td className="py-3 pl-2 text-right font-semibold">{formatCloudCostMoney(service.netCost, currency)}</td></tr>)}{cloudState === "ready" && report?.services.length === 0 ? <tr><td colSpan={2} className="py-8 text-center text-muted">Geen kostenregels in deze periode.</td></tr> : null}</tbody></table></section>
      </div>

      <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="managed-costs-heading" aria-busy={costsState === "loading"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="managed-costs-heading" className="text-heading-md">Beheerkosten</h2><p className="mt-1 max-w-2xl text-body-sm text-muted">Vaste en eenmalige kosten voor PhotoRoom, Prisma en andere beheerde diensten.</p></div>{costsCanManage ? <button type="button" onClick={() => { setEditingCost("new"); setCostMessage(null); }} className={primaryButtonClass}><Plus className="h-4 w-4" aria-hidden="true" />Kostenpost toevoegen</button> : null}</div>
        {costsState === "loading" ? <p className="mt-5 text-body-sm text-muted">Beheerkosten worden opgehaald…</p> : null}
        {costsState === "error" ? <div className="mt-5 rounded-panel border border-red-200 bg-red-50 p-4 text-body-sm text-red-900"><p>{costsError}</p><button type="button" onClick={() => void loadCosts()} className="mt-3 min-h-11 rounded-button border border-red-300 px-4 font-semibold">Opnieuw proberen</button></div> : null}
        {costsState === "ready" ? <><div className="mt-5 grid gap-3 sm:grid-cols-3">{providerSummaries.map((summary) => <article key={summary.provider} className="rounded-card border border-border bg-background p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{providerLabels[summary.provider]}</p><p className="mt-3 font-heading text-heading-sm font-bold">{formatManagedCostMoney(summary.monthlyCents)}</p><p className="mt-1 text-xs text-muted">{summary.monthlyCents === null ? "Nog geen periodiek bedrag" : `per maand · ${summary.count} actief`}</p></article>)}</div>{costs.length === 0 ? <div className="mt-5 rounded-panel border border-dashed border-border p-6 text-center"><p className="font-semibold">Nog geen beheerkosten vastgelegd</p><p className="mt-1 text-body-sm text-muted">PhotoRoom en Prisma verschijnen hier zodra de kostencatalogus beschikbaar is.</p></div> : <div className="mt-5 grid gap-3">{costs.map((cost) => <article key={cost.id} className="grid min-w-0 gap-3 rounded-card border border-border p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(8rem,.7fr)_minmax(8rem,.7fr)_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-heading-sm">{cost.providerName}</h3><span className={cn("rounded-full px-2 py-1 text-xs font-semibold", cost.active ? "bg-green-100 text-green-800" : "bg-background text-muted")}>{cost.active ? "Actief" : "Inactief"}</span></div><p className="mt-1 text-xs text-muted">{providerLabels[cost.provider]} · {categoryLabels[cost.category]}</p>{cost.description ? <p className="mt-2 break-words text-body-sm text-muted">{cost.description}</p> : null}</div><div><p className="text-xs text-muted">Bedrag</p><p className="mt-1 font-semibold">{formatManagedCostMoney(cost.amountCents, cost.currency)}</p></div><div><p className="text-xs text-muted">Herhaling</p><p className="mt-1 font-semibold">{recurrenceLabels[cost.recurrence]}</p>{cost.startsAt || cost.endsAt ? <p className="mt-1 text-xs text-muted">{formatDate(cost.startsAt) ?? "Geen start"} – {formatDate(cost.endsAt) ?? "doorlopend"}</p> : null}</div>{costsCanManage ? <div className="flex gap-2 md:justify-end"><button type="button" onClick={() => { setEditingCost(cost); setCostMessage(null); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border hover:border-border-hover" aria-label={`${cost.providerName} bewerken`}><Pencil className="h-4 w-4" aria-hidden="true" /></button><button type="button" onClick={() => void deleteCost(cost)} disabled={costBusy} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60" aria-label={`${cost.providerName} verwijderen`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div> : null}</article>)}</div>}</> : null}
        {costsCanManage && editingCost ? <CostEditor key={editingCost === "new" ? "new" : editingCost.id} cost={editingCost === "new" ? undefined : editingCost} busy={costBusy} onCancel={() => setEditingCost(null)} onSubmit={(event, value) => void saveCost(event, value)} /> : null}
        <p className={cn("mt-4 text-body-sm", costMessageIsError ? "font-semibold text-red-700" : "text-muted")} role="status" aria-live="polite">{costMessage}</p>
      </section>

      <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="invoices-heading" aria-busy={invoicesState === "loading"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="invoices-heading" className="text-heading-md">Facturen</h2><p className="mt-1 max-w-2xl text-body-sm text-muted">Bestands- en kostengegevens van facturen bij de beheerkosten.</p></div>{invoicesCanManage ? <button type="button" onClick={() => { setUploadOpen(true); setInvoiceMessage(null); }} className={primaryButtonClass}><Upload className="h-4 w-4" aria-hidden="true" />Factuur uploaden</button> : null}</div>
        {invoicesState === "loading" ? <p className="mt-5 text-body-sm text-muted">Facturen worden opgehaald…</p> : null}
        {invoicesState === "error" ? <div className="mt-5 rounded-panel border border-red-200 bg-red-50 p-4 text-body-sm text-red-900"><p>{invoicesError}</p><button type="button" onClick={() => void loadInvoices()} className="mt-3 min-h-11 rounded-button border border-red-300 px-4 font-semibold">Opnieuw proberen</button></div> : null}
        {invoicesState === "ready" && invoices.length === 0 ? <div className="mt-5 rounded-panel border border-dashed border-border p-6 text-center"><p className="font-semibold">Nog geen facturen opgeslagen</p><p className="mt-1 text-body-sm text-muted">Facturen verschijnen hier met alleen de benodigde bestands- en kostengegevens.</p></div> : null}
        {invoicesState === "ready" && invoices.length > 0 ? <div className="mt-5 grid gap-3">{invoices.map((invoice) => <article key={invoice.id} className="grid min-w-0 gap-3 rounded-card border border-border p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(8rem,.7fr)_minmax(8rem,.7fr)_auto] md:items-center"><div className="min-w-0"><h3 className="break-words text-heading-sm">{invoice.originalFilename}</h3><p className="mt-1 text-xs text-muted">{invoice.providerName ?? (invoice.provider ? providerLabels[invoice.provider] : "Niet gekoppeld")}{invoice.contentType ? ` · ${invoice.contentType}` : ""}{invoice.fileSize ? ` · ${Math.max(1, Math.round(invoice.fileSize / 1024))} kB` : ""}</p>{invoice.notes ? <p className="mt-2 break-words text-body-sm text-muted">{invoice.notes}</p> : null}</div><div><p className="text-xs text-muted">Factuurdatum</p><p className="mt-1 font-semibold">{formatDate(invoice.issuedAt) ?? "Niet opgegeven"}</p></div><div><p className="text-xs text-muted">Bedrag</p><p className="mt-1 font-semibold">{formatManagedCostMoney(invoice.amountCents, invoice.currency)}</p>{invoice.billingPeriodStart || invoice.billingPeriodEnd ? <p className="mt-1 text-xs text-muted">{formatDate(invoice.billingPeriodStart) ?? "–"} – {formatDate(invoice.billingPeriodEnd) ?? "–"}</p> : null}</div>{invoicesCanManage ? <div className="flex gap-2 md:justify-end"><a href={invoice.downloadUrl} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border hover:border-border-hover" aria-label={`${invoice.originalFilename} downloaden`}><Download className="h-4 w-4" aria-hidden="true" /></a><button type="button" onClick={() => void deleteInvoice(invoice)} disabled={invoiceBusy} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60" aria-label={`${invoice.originalFilename} verwijderen`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div> : null}</article>)}</div> : null}
        {invoicesCanManage && uploadOpen ? <InvoiceUploader costs={costs} busy={invoiceBusy} onCancel={() => setUploadOpen(false)} onSubmit={(event) => void uploadInvoice(event)} /> : null}
        <p className={cn("mt-4 text-body-sm", invoiceMessageIsError ? "font-semibold text-red-700" : "text-muted")} role="status" aria-live="polite">{invoiceMessage}</p>
      </section>
    </div>
  );
}
