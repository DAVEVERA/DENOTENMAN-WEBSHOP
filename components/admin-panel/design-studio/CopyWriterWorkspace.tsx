"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come from existing absolute and signed asset URLs. */

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FilePenLine,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type CopyCompleteness = "COMPLETE" | "MISSING_TEXT" | "MISSING_SEO" | "MISSING_PRODUCT_FACTS" | "NEEDS_REVIEW";
export type CopyFieldName = "name" | "slug" | "shortDescription" | "descriptionHtml" | "seoTitle" | "metaDescription" | "promotionText" | "ingredients" | "allergens" | "mayContainTraces";
export type FieldDecision = "keep" | "proposal" | "edit";

export type CopyWriterProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string | null;
  active: boolean;
  updatedAt: string;
  completeness: CopyCompleteness;
  attentionReasons: string[];
};

export type CopyWriterField = {
  name: CopyFieldName;
  label: string;
  group: "Identiteit" | "Verkooptekst" | "Vindbaarheid" | "Productfeiten" | string;
  current: string;
  proposed: string | null;
  maxLength: number;
  htmlMaxLength?: number;
  sourcePaths: string[];
  qualityStatus: string;
  qualityReason: string;
  warnings: string[];
  applyAllowed: boolean;
};

export type CopyWriterProposal = {
  id: string;
  productId: string;
  product: CopyWriterProduct;
  locale: "nl";
  status: "GENERATING" | "DRAFT" | "APPLIED" | "FAILED";
  sourceProductVersion: string;
  protectedFactsHash: string;
  fields: CopyWriterField[];
};

type ApiErrorBody = { error?: string; message?: string };
type RetryAction = (() => void) | null;

const copywriterPath = "/admin/design-studio/copywriter";
const proposalsApi = "/api/admin/design-studio/copywriter/proposals";
const productsApi = "/api/admin/design-studio/copywriter/products";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const statusLabels: Record<CopyCompleteness, string> = {
  COMPLETE: "Compleet",
  MISSING_TEXT: "Tekst mist",
  MISSING_SEO: "SEO mist",
  MISSING_PRODUCT_FACTS: "Productfeiten missen",
  NEEDS_REVIEW: "Controle nodig",
};

const expectedFields: Array<Pick<CopyWriterField, "name" | "label" | "group" | "maxLength">> = [
  { name: "name", label: "Productnaam", group: "Identiteit", maxLength: 180 },
  { name: "slug", label: "Slug", group: "Identiteit", maxLength: 160 },
  { name: "shortDescription", label: "Korte omschrijving", group: "Verkooptekst", maxLength: 220 },
  { name: "descriptionHtml", label: "Volledige omschrijving", group: "Verkooptekst", maxLength: 20000 },
  { name: "promotionText", label: "Productactietekst", group: "Verkooptekst", maxLength: 160 },
  { name: "seoTitle", label: "SEO-titel", group: "Vindbaarheid", maxLength: 60 },
  { name: "metaDescription", label: "Meta-omschrijving", group: "Vindbaarheid", maxLength: 160 },
  { name: "ingredients", label: "Ingrediënten", group: "Productfeiten", maxLength: 10000 },
  { name: "allergens", label: "Allergenen", group: "Productfeiten", maxLength: 10000 },
  { name: "mayContainTraces", label: "Kan sporen bevatten van", group: "Productfeiten", maxLength: 10000 },
];

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ApiErrorBody) | null;
  if (!response.ok) {
    const error = new Error(body?.message || (body?.error === "STALE_PRODUCT" ? "Het product is intussen gewijzigd. Laad de actuele tekst opnieuw." : "De aanvraag is niet gelukt."));
    error.name = body?.error || "REQUEST_FAILED";
    throw error;
  }
  if (!body) throw new Error("De server retourneerde geen geldig antwoord.");
  return body;
}

function randomKey(prefix: string) {
  return `${prefix}:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
}

function stableRequestKey(
  ref: { current: { fingerprint: string; key: string } | null },
  fingerprint: string,
  prefix: string,
) {
  if (ref.current?.fingerprint !== fingerprint) ref.current = { fingerprint, key: randomKey(prefix) };
  return ref.current.key;
}

function visibleLength(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}

function normalizedProposal(body: CopyWriterProposal | { proposal: CopyWriterProposal }) {
  return "proposal" in body ? body.proposal : body;
}

export function countSelectedChanges(
  fields: CopyWriterField[],
  decisions: Partial<Record<CopyFieldName, FieldDecision>>,
  edits: Partial<Record<CopyFieldName, string>> = {},
) {
  return fields.filter((field) => {
    const decision = decisions[field.name];
    if (!field.applyAllowed || (decision !== "proposal" && decision !== "edit")) return false;
    const value = decision === "edit" ? edits[field.name] ?? field.proposed : field.proposed;
    return value !== null && value !== field.current;
  }).length;
}

function WorkspaceHeader({ title, description, backHref = "/admin/design-studio", backLabel = "Design Studio" }: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}</Link>
      <p className="mt-3 font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Redactie · Gemini</p>
      <h1 className="mt-2 text-heading-lg text-text sm:text-heading-xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-body-sm leading-6 text-muted sm:text-body-md">{description}</p>
    </header>
  );
}

function RequestStatus({ busy, busyText, error, message, retry, cancel }: {
  busy: boolean;
  busyText: string;
  error: string | null;
  message: string | null;
  retry: RetryAction;
  cancel: () => void;
}) {
  return (
    <div className="mt-4 min-h-11" aria-live="polite">
      {busy ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3 text-body-sm text-muted"><LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="flex-1 font-semibold">{busyText}</span><button type="button" onClick={cancel} className={`${buttonClass} border border-border bg-background text-text`}>Annuleren</button></div> : null}
      {!busy && error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm text-red-800"><CircleAlert className="h-5 w-5" aria-hidden="true" /><span className="flex-1 font-semibold">{error}</span>{retry ? <button type="button" onClick={retry} className={`${buttonClass} border border-red-300 bg-surface text-red-800`}><RefreshCw className="h-4 w-4" aria-hidden="true" />Opnieuw proberen</button> : null}</div> : null}
      {!busy && !error && message ? <p role="status" className="rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800">{message}</p> : null}
    </div>
  );
}

export function CopyWriterWorkspace({ mode, productId, initialProducts, initialProduct, initialProposal }: {
  mode: "overview" | "product";
  productId?: string;
  initialProducts?: CopyWriterProduct[];
  initialProduct?: CopyWriterProduct | null;
  initialProposal?: CopyWriterProposal | null;
}) {
  const [products, setProducts] = useState(initialProducts || []);
  const [product, setProduct] = useState<CopyWriterProduct | null>(initialProduct || initialProposal?.product || null);
  const [proposal, setProposal] = useState<CopyWriterProposal | null>(initialProposal || null);
  const [busy, setBusy] = useState(mode === "overview" ? initialProducts === undefined : initialProduct === undefined && initialProposal === undefined);
  const [busyText, setBusyText] = useState("Producten laden…");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryAction>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generationKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  function beginRequest(text: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setBusyText(text);
    setError(null);
    setMessage(null);
    return controller;
  }

  function finishRequest(controller: AbortController) {
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setBusy(false);
    }
  }

  function failRequest(cause: unknown, retryAction: () => void) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      setMessage("Aanvraag geannuleerd. Er is niets toegepast.");
      return;
    }
    const stale = cause instanceof Error && cause.name === "STALE_PRODUCT";
    setError(stale ? "Dit product is intussen gewijzigd. Laad de actuele tekst en maak daarna een nieuw voorstel." : cause instanceof Error ? cause.message : "Er ging iets mis.");
    setRetry(() => retryAction);
  }

  function cancelRequest() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
    setMessage("Aanvraag geannuleerd. Er is niets toegepast.");
  }

  async function loadProducts() {
    const controller = beginRequest("Alle productteksten op volledigheid controleren…");
    try {
      const body = await responseBody<{ products: CopyWriterProduct[] }>(await fetch(`${productsApi}?limit=250&locale=nl`, { cache: "no-store", signal: controller.signal }));
      setProducts(body.products || []);
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void loadProducts());
    } finally {
      finishRequest(controller);
    }
  }

  async function loadProduct() {
    if (!productId) return;
    const controller = beginRequest("Actuele producttekst laden…");
    try {
      const body = await responseBody<{ product: CopyWriterProduct; proposal?: CopyWriterProposal | null }>(await fetch(`${productsApi}/${encodeURIComponent(productId)}?locale=nl`, { cache: "no-store", signal: controller.signal }));
      setProduct(body.product);
      setProposal(body.proposal || null);
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void loadProduct());
    } finally {
      finishRequest(controller);
    }
  }

  async function generateProposal() {
    if (!productId) return;
    const controller = beginRequest("Producttekst analyseren en voorstel maken…");
    try {
      const body = await responseBody<CopyWriterProposal | { proposal: CopyWriterProposal }>(await fetch(proposalsApi, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": stableRequestKey(generationKeyRef, `${productId}:nl`, "copywriter-generate") },
        body: JSON.stringify({ productId, locale: "nl" }),
        signal: controller.signal,
      }));
      const next = normalizedProposal(body);
      setProposal(next);
      setProduct(next.product);
      generationKeyRef.current = null;
      setMessage("Voorstel klaar. Er is nog geen enkel veld geselecteerd.");
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void generateProposal());
    } finally {
      finishRequest(controller);
    }
  }

  useEffect(() => {
    if (mode === "overview" && initialProducts === undefined) void loadProducts();
    if (mode === "product" && initialProduct === undefined && initialProposal === undefined) void loadProduct();
    return () => controllerRef.current?.abort();
    // Initial route props deliberately define the one-time hydration request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, productId]);

  const requestStatus = <RequestStatus busy={busy} busyText={busyText} error={error} message={message} retry={retry} cancel={cancelRequest} />;
  if (mode === "overview") return <ProductOverview products={products} busy={busy} requestStatus={requestStatus} />;
  return <EditorialWorkspace key={proposal?.id || "no-proposal"} product={product} proposal={proposal} busy={busy} requestStatus={requestStatus} generateProposal={generateProposal} beginRequest={beginRequest} finishRequest={finishRequest} failRequest={failRequest} setProposal={setProposal} setMessage={setMessage} setRetry={setRetry} />;
}

function ProductOverview({ products, busy, requestStatus }: { products: CopyWriterProduct[]; busy: boolean; requestStatus: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | CopyCompleteness>("ALL");
  const visible = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku}`.toLocaleLowerCase("nl").includes(query.trim().toLocaleLowerCase("nl"));
    return matchesQuery && (filter === "ALL" || product.completeness === filter);
  }), [products, query, filter]);
  const nextAttention = products.find((product) => product.completeness !== "COMPLETE");

  return (
    <div>
      <WorkspaceHeader title="De Notenman CopyWriter" description="Controleer alle producten zonder AI-kosten op ontbrekende tekst, SEO en productfeiten. Open daarna één product voor een bewerkbaar voorstel." />
      {requestStatus}
      <section className="mt-5 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-labelledby="catalog-title">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-ink">Cataloguscontrole</p><h2 id="catalog-title" className="mt-1 text-heading-md text-text">Alle producten</h2><p className="mt-1 text-body-sm text-muted">{products.length} producten deterministisch gecontroleerd</p></div>{nextAttention ? <Link href={`${copywriterPath}/${encodeURIComponent(nextAttention.id)}?locale=nl`} className={`${buttonClass} bg-accent text-contrast`}>Volgend product met aandacht <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}</div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
          <label className="relative block"><span className="sr-only">Zoek op product of SKU</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op product of SKU" className={`${inputClass} pl-10`} /></label>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter op volledigheid"><button type="button" aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")} className={`${buttonClass} shrink-0 ${filter === "ALL" ? "bg-accent-ink text-surface" : "border border-border bg-background text-text"}`}>Alle statussen</button>{Object.entries(statusLabels).map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id as CopyCompleteness)} className={`${buttonClass} shrink-0 ${filter === id ? "bg-accent-ink text-surface" : "border border-border bg-background text-text"}`}>{label}</button>)}</div>
        </div>
        {!busy && visible.length === 0 ? <p className="mt-6 rounded-card bg-background p-4 text-body-sm text-muted">Geen producten passen bij deze zoekopdracht en status.</p> : null}
        <div className="mt-5 grid gap-3">{visible.map((product) => <article key={product.id} className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-button border border-border bg-surface">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted" aria-hidden="true" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-heading text-body-md font-bold text-text">{product.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${product.completeness === "COMPLETE" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{statusLabels[product.completeness]}</span>{!product.active ? <span className="rounded-full bg-border px-2 py-1 text-xs font-semibold text-muted">Inactief</span> : null}</div><p className="mt-1 text-xs text-muted">SKU {product.sku}{product.attentionReasons[0] ? ` · ${product.attentionReasons[0]}` : ""}</p></div><Link href={`${copywriterPath}/${encodeURIComponent(product.id)}?locale=nl`} className={`${buttonClass} w-full border border-border bg-surface text-text sm:w-auto`}>Open redactie <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></article>)}</div>
      </section>
    </div>
  );
}

function EditorialWorkspace({ product, proposal, busy, requestStatus, generateProposal, beginRequest, finishRequest, failRequest, setProposal, setMessage, setRetry }: {
  product: CopyWriterProduct | null;
  proposal: CopyWriterProposal | null;
  busy: boolean;
  requestStatus: React.ReactNode;
  generateProposal: () => Promise<void>;
  beginRequest: (text: string) => AbortController;
  finishRequest: (controller: AbortController) => void;
  failRequest: (cause: unknown, retryAction: () => void) => void;
  setProposal: (proposal: CopyWriterProposal) => void;
  setMessage: (message: string | null) => void;
  setRetry: (retry: RetryAction) => void;
}) {
  const [decisions, setDecisions] = useState<Partial<Record<CopyFieldName, FieldDecision>>>({});
  const [edits, setEdits] = useState<Partial<Record<CopyFieldName, string>>>(() => Object.fromEntries((proposal?.fields || []).map((field) => [field.name, field.proposed || ""])));
  const [dirty, setDirty] = useState<Set<CopyFieldName>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const editKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const applyKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeConfirmation();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirmOpen]);

  const fields = proposal?.fields || [];
  const selectedCount = countSelectedChanges(fields, decisions, edits);
  const selectedFields = fields.filter((field) => {
    const decision = decisions[field.name];
    const next = decision === "edit" ? edits[field.name] ?? field.proposed : field.proposed;
    return field.applyAllowed && (decision === "proposal" || decision === "edit") && next !== null && next !== field.current;
  });

  function changeDecision(field: CopyWriterField, decision: FieldDecision) {
    if (!field.applyAllowed && decision !== "keep") return;
    setDecisions((current) => ({ ...current, [field.name]: decision }));
  }

  function changeEdit(field: CopyWriterField, value: string) {
    setEdits((current) => ({ ...current, [field.name]: value }));
    setDirty((current) => new Set(current).add(field.name));
  }

  async function persistEdits() {
    if (!proposal || dirty.size === 0) return proposal;
    const controller = beginRequest("Redactionele bewerkingen opslaan…");
    try {
      const editPayload = Object.fromEntries([...dirty].map((fieldName) => [fieldName, edits[fieldName] || ""]));
      const fingerprint = `${proposal.id}:${JSON.stringify(editPayload)}`;
      const body = await responseBody<CopyWriterProposal | { proposal: CopyWriterProposal }>(await fetch(`${proposalsApi}/${encodeURIComponent(proposal.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "idempotency-key": stableRequestKey(editKeyRef, fingerprint, "copywriter-edit") },
        body: JSON.stringify({ edits: editPayload }),
        signal: controller.signal,
      }));
      const next = normalizedProposal(body);
      setProposal(next);
      setDirty(new Set());
      editKeyRef.current = null;
      setMessage("Bewerkingen opgeslagen in het voorstel.");
      setRetry(null);
      return next;
    } catch (cause) {
      failRequest(cause, () => void persistEdits());
      return null;
    } finally {
      finishRequest(controller);
    }
  }

  async function openConfirmation() {
    if (!proposal || selectedCount === 0) return;
    const saved = await persistEdits();
    if (!saved) return;
    setConfirmed(false);
    setConfirmOpen(true);
  }

  function closeConfirmation() {
    setConfirmOpen(false);
    setConfirmed(false);
    requestAnimationFrame(() => reviewButtonRef.current?.focus());
  }

  async function applySelected() {
    if (!proposal || !confirmed || selectedCount === 0) return;
    const controller = beginRequest(`Exact ${selectedCount} wijzigingen toepassen…`);
    try {
      const fingerprint = `${proposal.id}:${proposal.sourceProductVersion}:${selectedFields.map((field) => field.name).join(",")}`;
      const body = await responseBody<CopyWriterProposal | { proposal: CopyWriterProposal }>(await fetch(`${proposalsApi}/${encodeURIComponent(proposal.id)}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": stableRequestKey(applyKeyRef, fingerprint, "copywriter-apply") },
        body: JSON.stringify({
          sourceProductVersion: proposal.sourceProductVersion,
          protectedFactsHash: proposal.protectedFactsHash,
          selectedFields: selectedFields.map((field) => field.name),
          confirmation: "APPLY_SELECTED_FIELDS",
        }),
        signal: controller.signal,
      }));
      setProposal(normalizedProposal(body));
      setDecisions({});
      setDirty(new Set());
      setConfirmOpen(false);
      setConfirmed(false);
      applyKeyRef.current = null;
      setMessage(`${selectedCount} wijzigingen zijn toegepast. Niet-geselecteerde velden zijn ongewijzigd gebleven.`);
      setRetry(null);
    } catch (cause) {
      setConfirmOpen(false);
      setConfirmed(false);
      failRequest(cause, () => void applySelected());
    } finally {
      finishRequest(controller);
    }
  }

  return (
    <div className="pb-24">
      <WorkspaceHeader title={product?.name || "Producttekst laden"} description="Vergelijk de huidige Nederlandse tekst met het voorstel. Jij kiest per veld wat er wel en niet wordt toegepast." backHref={copywriterPath} backLabel="Alle producten" />
      {requestStatus}
      {product ? <div className="mt-5 grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-card sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:p-5"><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border border-border bg-background">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <FilePenLine className="h-7 w-7 text-muted" aria-hidden="true" />}</div><div className="min-w-0"><p className="font-heading text-heading-sm font-bold text-text">{product.name}</p><p className="mt-1 text-xs text-muted">SKU {product.sku} · Nederlands · {product.active ? "Actief" : "Inactief"}</p><p className="mt-2 text-body-sm text-muted">Status: <strong className="text-text">{statusLabels[product.completeness]}</strong></p></div><button type="button" disabled={busy} onClick={() => void generateProposal()} className={`${buttonClass} w-full bg-accent text-contrast sm:w-auto`}><RefreshCw className="h-4 w-4" aria-hidden="true" />{proposal ? "Nieuw voorstel maken" : "Analyseer producttekst"}</button></div> : null}

      {!proposal && !busy ? <section className="mt-5 rounded-panel border border-dashed border-border bg-background p-6 text-center"><FilePenLine className="mx-auto h-8 w-8 text-muted" aria-hidden="true" /><h2 className="mt-3 text-heading-md text-text">Nog geen redactioneel voorstel</h2><p className="mx-auto mt-2 max-w-xl text-body-sm leading-6 text-muted">De analyse leest het actuele productsnapshot. Er wordt niets gewijzigd totdat je afzonderlijke velden kiest en de eindcontrole bevestigt.</p></section> : null}

      {proposal ? <div className="mt-6 grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
        <aside className="h-fit rounded-panel border border-border bg-surface p-4 shadow-card xl:sticky xl:top-4"><h2 className="font-heading text-heading-sm font-bold text-text">Productcontext</h2><dl className="mt-3 grid gap-3 text-body-sm"><div><dt className="font-bold text-muted">Product</dt><dd className="break-words text-text">{proposal.product.name}</dd></div><div><dt className="font-bold text-muted">Locale</dt><dd className="text-text">Nederlands (nl)</dd></div><div><dt className="font-bold text-muted">Voorstelstatus</dt><dd className="text-text">{proposal.status}</dd></div></dl><p className="mt-4 text-xs leading-5 text-muted">Geen veld is vooraf geselecteerd. Een nieuw voorstel verandert de productdata niet.</p></aside>
        <main className="min-w-0" aria-label="Redactioneel veldenregister"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-ink">Huidig versus voorstel</p><h2 className="mt-1 text-heading-md text-text">Redactioneel veldenregister</h2></div><span className="text-xs font-semibold text-muted">10 vereiste velden</span></div><div className="grid gap-4">{expectedFields.map((expected) => {
          const field = fields.find((item) => item.name === expected.name) || { ...expected, current: "", proposed: null, sourcePaths: [], qualityStatus: "MISSING_PROPOSAL_FIELD", qualityReason: "Dit veld ontbreekt in het gevalideerde voorstel.", warnings: ["Maak een nieuw voorstel voordat je dit veld gebruikt."], applyAllowed: false };
          return <EditorialFieldCard key={field.name} field={field} decision={decisions[field.name] || "keep"} editedValue={edits[field.name] ?? field.proposed ?? ""} dirty={dirty.has(field.name)} onDecision={(decision) => changeDecision(field, decision)} onEdit={(value) => changeEdit(field, value)} onSave={() => void persistEdits()} busy={busy} />;
        })}</div></main>
        <aside className="h-fit rounded-panel border border-border bg-surface p-4 shadow-card xl:sticky xl:top-4"><h2 className="font-heading text-heading-sm font-bold text-text">Controlepunten</h2><div className="mt-3 grid gap-3"><div className="rounded-card bg-background p-3"><p className="text-xs font-bold uppercase text-muted">SEO en URL</p><p className="mt-1 text-body-sm text-text">Een geselecteerde slug krijgt een afzonderlijke waarschuwing in de eindcontrole.</p></div><div className="rounded-card border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-xs font-bold uppercase text-amber-900"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Productfeiten</p><p className="mt-1 text-body-sm text-amber-900">Ontbrekende ingrediënten, allergenen of sporen blijven geblokkeerd zonder gecontroleerde bron.</p></div></div></aside>
      </div> : null}

      {proposal ? <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 shadow-[0_-4px_16px_rgba(20,20,20,0.12)] backdrop-blur sm:left-auto sm:right-4 sm:bottom-4 sm:w-[min(34rem,calc(100%-2rem))] sm:rounded-panel sm:border"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-heading text-body-md font-bold text-text">{selectedCount} {selectedCount === 1 ? "wijziging geselecteerd" : "wijzigingen geselecteerd"}</p><p className="text-xs text-muted">Alleen gekozen, werkelijk gewijzigde velden tellen mee.</p></div>{dirty.size ? <button type="button" disabled={busy} onClick={() => void persistEdits()} className={`${buttonClass} border border-border bg-surface text-text`}><Save className="h-4 w-4" aria-hidden="true" />Bewerkingen opslaan</button> : null}<button ref={reviewButtonRef} type="button" disabled={busy || selectedCount === 0 || proposal.status !== "DRAFT"} onClick={() => void openConfirmation()} className={`${buttonClass} bg-accent-ink text-surface`}>Eindcontrole ({selectedCount})</button></div></div> : null}

      {confirmOpen && proposal ? <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-contrast/60 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="copy-confirm-title" className="max-h-[100dvh] w-full overflow-y-auto rounded-t-panel border border-border bg-surface p-4 shadow-card sm:max-w-xl sm:rounded-panel sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-ink">Laatste controle</p><h2 id="copy-confirm-title" className="mt-1 text-heading-md text-text">Pas {selectedCount} wijzigingen toe?</h2></div><button type="button" onClick={closeConfirmation} aria-label="Sluit eindcontrole" className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border text-text"><X className="h-5 w-5" aria-hidden="true" /></button></div><dl className="mt-4 grid gap-2 rounded-card bg-background p-3 text-body-sm"><div><dt className="font-bold text-muted">Product</dt><dd className="text-text">{proposal.product.name}</dd></div><div><dt className="font-bold text-muted">Locale</dt><dd className="text-text">Nederlands</dd></div></dl><h3 className="mt-4 font-heading text-heading-sm font-bold text-text">Geselecteerde velden</h3><ul className="mt-2 grid gap-2">{selectedFields.map((field) => <li key={field.name} className="flex min-h-11 items-center gap-2 rounded-button border border-border px-3 text-body-sm text-text"><Check className="h-4 w-4 text-accent-ink" aria-hidden="true" />{field.label}{field.name === "slug" ? <span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">URL wijzigt</span> : null}</li>)}</ul><label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-border bg-background p-3 text-body-sm text-text"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong>Ik heb de geselecteerde velden gecontroleerd.</strong><span className="mt-1 block text-xs text-muted">Niet-geselecteerde velden blijven ongewijzigd. Productfeiten zonder bron zijn niet opgenomen.</span></span></label><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={closeConfirmation} className={`${buttonClass} border border-border bg-surface text-text`}>Annuleren</button><button type="button" disabled={!confirmed || busy} onClick={() => void applySelected()} className={`${buttonClass} bg-accent text-contrast`}>{`Pas ${selectedCount} wijzigingen toe`}</button></div></section></div> : null}
    </div>
  );
}

function EditorialFieldCard({ field, decision, editedValue, dirty, onDecision, onEdit, onSave, busy }: {
  field: CopyWriterField;
  decision: FieldDecision;
  editedValue: string;
  dirty: boolean;
  onDecision: (decision: FieldDecision) => void;
  onEdit: (value: string) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const factField = field.group === "Productfeiten";
  const proposedLength = visibleLength(decision === "edit" ? editedValue : field.proposed || "");
  const blocked = !field.applyAllowed || field.proposed === null;
  const textAreaRows = field.name === "descriptionHtml" ? 8 : field.name === "shortDescription" || field.name === "ingredients" || field.name === "allergens" || field.name === "mayContainTraces" ? 4 : 3;

  return (
    <article data-editorial-field={field.name} className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-ink">{field.group}</p><h3 className="mt-1 text-heading-sm font-bold text-text">{field.label}</h3></div><span className={`max-w-full break-words rounded-full px-2.5 py-1 text-xs font-bold ${blocked ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>{field.qualityStatus}</span></div>
      <p className="mt-3 text-body-sm leading-6 text-muted">{field.qualityReason}</p>
      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-card border border-border bg-background p-3"><h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Huidige waarde</h4><div className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-body-sm leading-6 text-text">{field.current || <span className="italic text-muted">Leeg</span>}</div><p className="mt-2 text-xs text-muted">{visibleLength(field.current)} tekens</p></section>
        <section className={`min-w-0 rounded-card border p-3 ${blocked ? "border-amber-200 bg-amber-50" : "border-accent/50 bg-accent/10"}`}><h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Voorstel</h4>{decision === "edit" ? <textarea value={editedValue} onChange={(event) => onEdit(event.target.value)} maxLength={field.name === "descriptionHtml" ? field.htmlMaxLength || 50000 : field.maxLength} rows={textAreaRows} className={`${inputClass} mt-2 resize-y py-3 leading-6`} aria-label={`${field.label} bewerken`} /> : <div className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-body-sm leading-6 text-text">{field.proposed ?? <span className="italic text-amber-900">Geen voorstel beschikbaar</span>}</div>}<p className={`mt-2 text-xs ${proposedLength > field.maxLength ? "font-bold text-red-700" : "text-muted"}`}>{proposedLength} / {field.maxLength} zichtbare tekens{field.name === "descriptionHtml" ? " · maximaal 50.000 HTML-tekens bij opslaan" : ""}</p>{dirty ? <button type="button" disabled={busy} onClick={onSave} className={`${buttonClass} mt-3 border border-border bg-surface text-text`}><Save className="h-4 w-4" aria-hidden="true" />Bewerking opslaan</button> : null}</section>
      </div>
      <fieldset className="mt-4"><legend className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Beslissing voor dit veld</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{([
        ["keep", "Huidig behouden"],
        ["proposal", "Voorstel gebruiken"],
        ["edit", "Bewerken en meenemen"],
      ] as const).map(([value, label]) => {
        const disabled = value !== "keep" && (blocked || value === "edit" && factField);
        return <label key={value} className={`flex min-h-11 items-center gap-2 rounded-button border px-3 text-body-sm font-semibold ${decision === value ? "border-accent-ink bg-accent/15 text-text" : "border-border bg-surface text-muted"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}><input type="radio" name={`decision-${field.name}`} value={value} checked={decision === value} disabled={disabled} onChange={() => onDecision(value)} />{label}</label>;
      })}</div></fieldset>
      <div className="mt-4 border-t border-border pt-3 text-xs text-muted"><p><strong className="text-text">Bronpaden:</strong> {field.sourcePaths.length ? field.sourcePaths.join(", ") : "Geen vertrouwde bron"}</p>{field.warnings.map((warning) => <p key={warning} className="mt-2 flex gap-2 text-amber-900"><ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{warning}</p>)}</div>
    </article>
  );
}
