"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come from existing absolute and signed asset URLs. */

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CircleAlert,
  FilePenLine,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { productEditorHref } from "@/lib/admin-return-to";

export type CopyCompleteness = "COMPLETE" | "MISSING_TEXT" | "MISSING_SEO" | "MISSING_PRODUCT_FACTS" | "NEEDS_REVIEW";
export type NutritionFieldName = "nutritionEnergyKj" | "nutritionEnergyKcal" | "nutritionFat" | "nutritionSaturatedFat" | "nutritionCarbohydrates" | "nutritionSugars" | "nutritionFiber" | "nutritionProtein" | "nutritionSalt";
export type CopyFieldName = "name" | "slug" | "shortDescription" | "descriptionHtml" | "seoTitle" | "metaDescription" | "promotionText" | "ingredients" | "allergens" | "mayContainTraces" | NutritionFieldName;
export type FieldDecision = "keep" | "proposal" | "edit";
export type CopyProposalStatus = "GENERATING" | "DRAFT" | "APPLIED" | "FAILED";

export type CopyWriterAttentionField = {
  field: CopyFieldName;
  label: string;
  reason: string;
  kind: "MISSING" | "NEEDS_REVIEW";
  outsideCopywriter: boolean;
};

export type CopyWriterProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string | null;
  active: boolean;
  updatedAt: string;
  completeness: CopyCompleteness;
  attentionReasons: string[];
  attentionFields?: CopyWriterAttentionField[];
  acceptedFields?: CopyFieldName[];
  latestProposal?: { status: CopyProposalStatus; createdAt: string; appliedAt: string | null; errorCode: string | null } | null;
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
  /** Product info only: SOURCE_EXACT, AI_ESTIMATE, ADMIN_ENTERED or MISSING_VERIFIED_SOURCE. */
  sourceStatus?: string | null;
  /** Nutrition only: the unit per 100 g. */
  unit?: string;
};

export type CopyWriterProposal = {
  id: string;
  productId: string;
  product: CopyWriterProduct;
  locale: "nl";
  status: CopyProposalStatus;
  sourceProductVersion: string;
  protectedFactsHash: string;
  stale?: boolean;
  createdAt?: string | null;
  fields: CopyWriterField[];
};

type ApiErrorBody = { error?: string; message?: string };
type RetryAction = (() => void) | null;
type Bucket = "todo" | "info" | "done";
type OverviewFilter = "ALL" | "todo" | "draft" | "info" | "done";

const copywriterPath = "/admin/design-studio/copywriter";
const proposalsApi = "/api/admin/design-studio/copywriter/proposals";
const productsApi = "/api/admin/design-studio/copywriter/products";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export const statusLabels: Record<CopyCompleteness, string> = {
  COMPLETE: "Op orde",
  MISSING_TEXT: "Tekst ontbreekt",
  MISSING_SEO: "SEO ontbreekt",
  MISSING_PRODUCT_FACTS: "Productinfo ontbreekt",
  NEEDS_REVIEW: "Nakijken",
};

const severity: Record<CopyCompleteness, number> = {
  MISSING_TEXT: 0,
  MISSING_SEO: 1,
  NEEDS_REVIEW: 2,
  MISSING_PRODUCT_FACTS: 3,
  COMPLETE: 4,
};

const productInfoFields = new Set<CopyFieldName>([
  "ingredients", "allergens", "mayContainTraces",
  "nutritionEnergyKj", "nutritionEnergyKcal", "nutritionFat", "nutritionSaturatedFat",
  "nutritionCarbohydrates", "nutritionSugars", "nutritionFiber", "nutritionProtein", "nutritionSalt",
]);

function isNutrition(field: CopyFieldName) {
  return field.startsWith("nutrition");
}

function isEstimate(field: CopyWriterField) {
  return field.sourceStatus === "AI_ESTIMATE" || field.sourceStatus === "ADMIN_ENTERED";
}

function statusTone(status: CopyCompleteness) {
  if (status === "COMPLETE") return "bg-green-100 text-green-800";
  if (status === "MISSING_PRODUCT_FACTS") return "bg-border text-text";
  return "bg-amber-100 text-amber-900";
}

function attention(product: CopyWriterProduct) {
  return product.attentionFields ?? [];
}

/** The CopyWriter can improve at least one field of this product. */
function isFixable(product: CopyWriterProduct) {
  if (product.attentionFields) return product.attentionFields.length > 0;
  return product.completeness !== "COMPLETE";
}

/** Products that only miss product info (facts or nutrition) form their own group. */
function bucketOf(product: CopyWriterProduct): Bucket {
  if (product.completeness === "COMPLETE") return "done";
  const items = product.attentionFields;
  if (items?.length) return items.every((item) => productInfoFields.has(item.field)) ? "info" : "todo";
  return product.completeness === "MISSING_PRODUCT_FACTS" ? "info" : "todo";
}

function hasDraft(product: CopyWriterProduct) {
  return product.latestProposal?.status === "DRAFT";
}

const bucketOrder: Record<Bucket, number> = { todo: 0, info: 1, done: 2 };

export function sortForWork(products: CopyWriterProduct[]) {
  return [...products].sort((a, b) => (
    bucketOrder[bucketOf(a)] - bucketOrder[bucketOf(b)]
    || Number(hasDraft(b)) - Number(hasDraft(a))
    || severity[a.completeness] - severity[b.completeness]
    || Number(b.active) - Number(a.active)
    || a.name.localeCompare(b.name, "nl")
  ));
}

/** Next product the CopyWriter can help with, never the one currently open. */
export function nextProductToWork(products: CopyWriterProduct[], excludeId?: string) {
  return sortForWork(products).find((product) => product.id !== excludeId && isFixable(product)) ?? null;
}

export type OverviewContext = { filter: OverviewFilter; query: string };

const overviewFilters: OverviewFilter[] = ["ALL", "todo", "draft", "info", "done"];

export function overviewContext(filter?: string | null, query?: string | null): OverviewContext {
  return {
    filter: overviewFilters.includes(filter as OverviewFilter) ? filter as OverviewFilter : "ALL",
    query: (query ?? "").slice(0, 100),
  };
}

function contextParams(context?: OverviewContext) {
  const params = new URLSearchParams();
  if (context && context.filter !== "ALL") params.set("filter", context.filter);
  if (context?.query.trim()) params.set("q", context.query.trim());
  return params;
}

function productHref(id: string, context?: OverviewContext) {
  const params = contextParams(context);
  params.set("locale", "nl");
  return `${copywriterPath}/${encodeURIComponent(id)}?${params.toString()}`;
}

function overviewHref(context?: OverviewContext) {
  const params = contextParams(context).toString();
  return params ? `${copywriterPath}?${params}` : copywriterPath;
}

/** The products as the overview lists them for a filter and search, in the same order. */
export function productsInView(products: CopyWriterProduct[], context: OverviewContext) {
  const query = context.query.trim().toLocaleLowerCase("nl");
  return sortForWork(products).filter((product) => {
    if (query && !`${product.name} ${product.sku}`.toLocaleLowerCase("nl").includes(query)) return false;
    if (context.filter === "ALL") return true;
    if (context.filter === "draft") return hasDraft(product);
    return bucketOf(product) === context.filter;
  });
}

export type ProductNeighbours = {
  previous: CopyWriterProduct | null;
  next: CopyWriterProduct | null;
  position: number;
  total: number;
};

/** Previous and next product around the open one, within the overview's filter and order. */
export function productNeighbours(products: CopyWriterProduct[], productId: string, context: OverviewContext): ProductNeighbours | null {
  const list = productsInView(products, context);
  const index = list.findIndex((product) => product.id === productId);
  if (index < 0) return null;
  return {
    previous: list[index - 1] ?? null,
    next: list[index + 1] ?? null,
    position: index + 1,
    total: list.length,
  };
}

function shortDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(value));
}

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ApiErrorBody) | null;
  if (!response.ok) {
    const error = new Error(body?.error === "STALE_PRODUCT"
      ? "Dit product is net aangepast. Laad de nieuwe tekst en schrijf opnieuw een voorstel."
      : body?.message || "Dat is niet gelukt. Probeer het opnieuw.");
    error.name = body?.error || "REQUEST_FAILED";
    throw error;
  }
  if (!body) throw new Error("De server gaf geen geldig antwoord.");
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

function plainText(value: string) {
  return value
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function visibleLength(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}

function normalizedProposal(body: CopyWriterProposal | { proposal: CopyWriterProposal }) {
  return "proposal" in body ? body.proposal : body;
}

function isChange(field: CopyWriterField) {
  return field.applyAllowed && field.proposed !== null && field.proposed !== field.current;
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
  if (busy) {
    return <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3 text-body-sm text-muted"><LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="flex-1 font-semibold">{busyText}</span><button type="button" onClick={cancel} className={`${buttonClass} border border-border bg-background text-text`}>Annuleren</button></div>;
  }
  if (error) {
    return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm text-red-800"><CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 font-semibold">{error}</span>{retry ? <button type="button" onClick={retry} className={`${buttonClass} border border-red-300 bg-surface text-red-800`}><RefreshCw className="h-4 w-4" aria-hidden="true" />Opnieuw proberen</button> : null}</div>;
  }
  if (message) {
    return <p role="status" className="rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800">{message}</p>;
  }
  return null;
}

export function CopyWriterWorkspace({ mode, productId, initialProducts, initialProduct, initialProposal, filter, query }: {
  mode: "overview" | "product";
  productId?: string;
  initialProducts?: CopyWriterProduct[];
  initialProduct?: CopyWriterProduct | null;
  initialProposal?: CopyWriterProposal | null;
  /** Overview filter and search, kept in the URL so product navigation follows the same list. */
  filter?: string;
  query?: string;
}) {
  const context = overviewContext(filter, query);
  const [products, setProducts] = useState(initialProducts || []);
  const [product, setProduct] = useState<CopyWriterProduct | null>(initialProduct || initialProposal?.product || null);
  const [proposal, setProposal] = useState<CopyWriterProposal | null>(initialProposal || null);
  const [busy, setBusy] = useState(mode === "overview" ? initialProducts === undefined : initialProduct === undefined && initialProposal === undefined);
  const [busyText, setBusyText] = useState(mode === "overview" ? "Producten laden…" : "Product laden…");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryAction>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generationKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<CopyWriterProduct[] | null>(initialProducts ?? null);

  function revealStatus() {
    requestAnimationFrame(() => statusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

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

  function showMessage(text: string | null) {
    setMessage(text);
    if (text) revealStatus();
  }

  function failRequest(cause: unknown, retryAction: () => void) {
    if (cause instanceof DOMException && cause.name === "AbortError") return;
    setError(cause instanceof Error ? cause.message : "Er ging iets mis.");
    setRetry(() => retryAction);
    revealStatus();
  }

  function cancelRequest() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    // A cancelled generation may still finish on the server; the next attempt starts a fresh request.
    generationKeyRef.current = null;
    setBusy(false);
    setMessage("Geannuleerd. Er is niets opgeslagen.");
  }

  async function fetchProducts(signal?: AbortSignal) {
    const body = await responseBody<{ products: CopyWriterProduct[] }>(await fetch(`${productsApi}?limit=500&locale=nl`, { cache: "no-store", signal }));
    return body.products || [];
  }

  async function loadProducts() {
    const controller = beginRequest("Producten laden…");
    try {
      setProducts(await fetchProducts(controller.signal));
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void loadProducts());
    } finally {
      finishRequest(controller);
    }
  }

  async function loadProduct() {
    if (!productId) return;
    const controller = beginRequest("Product laden…");
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
    const controller = beginRequest("Voorstel schrijven… Dit kan tot een minuut duren.");
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
      const changes = next.fields.filter(isChange).length;
      showMessage(changes
        ? `Voorstel klaar met ${changes} ${changes === 1 ? "verbetering" : "verbeteringen"}. Kies per veld wat je overneemt.`
        : "Voorstel klaar. De huidige tekst hoeft niet te veranderen.");
      setRetry(null);
    } catch (cause) {
      // A failed attempt is final on the server; retrying starts a new request.
      generationKeyRef.current = null;
      failRequest(cause, () => void generateProposal());
    } finally {
      finishRequest(controller);
    }
  }

  async function goToNextProduct(excludeId?: string) {
    const controller = beginRequest("Volgend product zoeken…");
    try {
      const next = nextProductToWork(await fetchProducts(controller.signal), excludeId);
      if (next) {
        window.location.assign(productHref(next.id, context));
        return;
      }
      showMessage("Alle producten zijn op orde. Er is nu niets te doen.");
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void goToNextProduct(excludeId));
    } finally {
      finishRequest(controller);
    }
  }

  useEffect(() => {
    if (mode !== "product" || initialProducts !== undefined) return;
    const controller = new AbortController();
    fetchProducts(controller.signal).then(setCatalog).catch(() => undefined);
    return () => controller.abort();
    // Loaded once per product page; the list only feeds previous/next navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, productId]);

  useEffect(() => {
    if (mode === "overview" && initialProducts === undefined) void loadProducts();
    if (mode === "product" && initialProduct === undefined && initialProposal === undefined) void loadProduct();
    return () => controllerRef.current?.abort();
    // Initial route props deliberately define the one-time hydration request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, productId]);

  const requestStatus = (
    <div ref={statusRef} className="scroll-mt-24 empty:hidden">
      <RequestStatus busy={busy} busyText={busyText} error={error} message={message} retry={retry} cancel={cancelRequest} />
    </div>
  );

  if (mode === "overview") return <ProductOverview products={products} busy={busy} requestStatus={requestStatus} initialContext={context} />;
  return (
    <EditorialWorkspace
      key={proposal?.id || "no-proposal"}
      product={product}
      proposal={proposal}
      busy={busy}
      requestStatus={requestStatus}
      generateProposal={generateProposal}
      goToNextProduct={() => void goToNextProduct(productId)}
      context={context}
      neighbours={catalog && productId ? productNeighbours(catalog, productId, context) : null}
      beginRequest={beginRequest}
      finishRequest={finishRequest}
      failRequest={failRequest}
      setProposal={setProposal}
      setProduct={setProduct}
      showMessage={showMessage}
      setRetry={setRetry}
    />
  );
}

function ProposalChip({ product }: { product: CopyWriterProduct }) {
  const latest = product.latestProposal;
  if (!latest) return null;
  if (latest.status === "DRAFT") return <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent-ink">Voorstel klaar</span>;
  if (latest.status === "APPLIED") return <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">Opgeslagen {shortDate(latest.appliedAt)}</span>;
  if (latest.status === "FAILED") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">Laatste poging mislukt</span>;
  return <span className="rounded-full bg-border px-2.5 py-1 text-xs font-semibold text-muted">Wordt geschreven</span>;
}

function ProductOverview({ products, busy, requestStatus, initialContext }: {
  products: CopyWriterProduct[];
  busy: boolean;
  requestStatus: React.ReactNode;
  initialContext: OverviewContext;
}) {
  const [query, setQuery] = useState(initialContext.query);
  const [filter, setFilter] = useState<OverviewFilter>(initialContext.filter);
  const context: OverviewContext = { filter, query };
  const counts = useMemo(() => ({
    ALL: products.length,
    todo: products.filter((product) => bucketOf(product) === "todo").length,
    draft: products.filter(hasDraft).length,
    info: products.filter((product) => bucketOf(product) === "info").length,
    done: products.filter((product) => bucketOf(product) === "done").length,
  }), [products]);
  const visible = useMemo(() => productsInView(products, { filter, query }), [products, query, filter]);

  // Keep filter and search in the address bar so "back" and product navigation return to this list.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", overviewHref({ filter, query }));
  }, [filter, query]);
  const next = nextProductToWork(products);

  const filters: Array<[OverviewFilter, string, string]> = [
    ["todo", "Te doen", "Tekst of SEO die de CopyWriter kan verbeteren"],
    ["draft", "Voorstel klaar", "Wacht op jouw keuze"],
    ["info", "Productinfo nodig", "AI vult ingrediënten, allergenen en voedingswaarden aan"],
    ["done", "Op orde", "Niets te doen"],
  ];

  return (
    <div>
      <WorkspaceHeader title="De Notenman CopyWriter" description="Zie welke producten betere tekst nodig hebben. Laat een voorstel schrijven, kies wat je overneemt en sla op." />
      <div className="mt-4">{requestStatus}</div>

      <section className="mt-5" aria-label="Samenvatting">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filters.map(([id, label, hint]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(filter === id ? "ALL" : id)} className={`min-h-11 rounded-panel border p-4 text-left shadow-card transition-colors ${filter === id ? "border-accent-ink bg-accent/15" : "border-border bg-surface hover:border-border-hover"}`}>
              <span className="block font-heading text-heading-lg text-text">{counts[id]}</span>
              <span className="mt-1 block font-heading text-body-sm font-bold text-text">{label}</span>
              <span className="mt-1 hidden text-xs text-muted sm:block">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-labelledby="catalog-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="catalog-title" className="text-heading-md text-text">Alle producten</h2>
            <p className="mt-1 text-body-sm text-muted">{products.length} producten · de lijst staat op volgorde van wat het eerst aandacht nodig heeft</p>
          </div>
          {next ? <Link href={productHref(next.id, context)} className={`${buttonClass} w-full bg-accent text-contrast sm:w-auto`}>Volgend product: {next.name} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
        </div>
        <label className="relative mt-5 block"><span className="sr-only">Zoek op product of SKU</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op product of SKU" className={`${inputClass} pl-10`} /></label>

        {!busy && products.length > 0 && counts.todo === 0 && counts.draft === 0 && filter === "ALL" && !query ? (
          <p className="mt-5 flex items-center gap-2 rounded-card border border-green-200 bg-green-50 p-4 text-body-sm font-semibold text-green-800"><CheckCheck className="h-5 w-5" aria-hidden="true" />Alle teksten zijn op orde. Er is nu niets te doen voor de CopyWriter.</p>
        ) : null}
        {!busy && visible.length === 0 && products.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card bg-background p-4 text-body-sm text-muted">
            <span className="flex-1">Geen producten met deze zoekopdracht of status.</span>
            <button type="button" onClick={() => { setFilter("ALL"); setQuery(""); }} className={`${buttonClass} border border-border bg-surface text-text`}>Filter wissen</button>
          </div>
        ) : null}

        <ul className="mt-5 grid gap-3">
          {visible.map((product) => {
            const reasons = product.attentionReasons;
            return (
              <li key={product.id} className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-card border border-border bg-background p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-button border border-border bg-surface">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted" aria-hidden="true" />}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 break-words font-heading text-body-md font-bold text-text">{product.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(product.completeness)}`}>{statusLabels[product.completeness]}</span>
                    <ProposalChip product={product} />
                    {!product.active ? <span className="rounded-full bg-border px-2 py-1 text-xs font-semibold text-muted">Inactief</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">SKU {product.sku}</p>
                  {reasons.length ? <ul className="mt-1 grid gap-0.5 text-xs text-muted">{reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}{reasons.length > 3 ? <li>+{reasons.length - 3} meer</li> : null}</ul> : null}
                </div>
                <Link href={productHref(product.id, context)} className={`${buttonClass} col-span-2 w-full border border-border bg-surface text-text sm:col-span-1 sm:w-auto`}>Openen <ArrowRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> {product.name}</span></Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function AttentionPanel({ product, busy, onAccept }: {
  product: CopyWriterProduct;
  busy: boolean;
  onAccept: (field: CopyWriterAttentionField) => void;
}) {
  const items = attention(product);
  const accepted = product.acceptedFields ?? [];
  if (!items.length && !accepted.length) return null;
  return (
    <section className="mt-4 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-labelledby="attention-title">
      <h2 id="attention-title" className="font-heading text-heading-sm font-bold text-text">Wat aandacht nodig heeft</h2>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item.field} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-background p-3 text-body-sm">
            <span className="min-w-0 flex-1"><strong className="text-text">{item.label}.</strong> <span className="text-muted">{item.reason}</span></span>
            {item.kind === "NEEDS_REVIEW" ? (
              <button type="button" disabled={busy} onClick={() => onAccept(item)} className={`${buttonClass} border border-border bg-surface text-text`}><Check className="h-4 w-4" aria-hidden="true" />Laten zoals het is</button>
            ) : null}
          </li>
        ))}
        {accepted.map((field) => (
          <li key={field} className="flex items-center gap-2 rounded-card bg-green-50 p-3 text-body-sm text-green-800"><Check className="h-4 w-4" aria-hidden="true" />{fieldLabel(field)} is nagekeken en blijft zoals het is.</li>
        ))}
      </ul>
    </section>
  );
}

const fieldLabels: Record<CopyFieldName, string> = {
  name: "Productnaam",
  slug: "Webadres (slug)",
  shortDescription: "Korte omschrijving",
  descriptionHtml: "Volledige omschrijving",
  seoTitle: "SEO-titel",
  metaDescription: "Meta-omschrijving",
  promotionText: "Actietekst",
  ingredients: "Ingrediënten",
  allergens: "Allergenen",
  mayContainTraces: "Kan sporen bevatten van",
  nutritionEnergyKj: "Energie (kJ)",
  nutritionEnergyKcal: "Energie (kcal)",
  nutritionFat: "Vetten",
  nutritionSaturatedFat: "Waarvan verzadigd",
  nutritionCarbohydrates: "Koolhydraten",
  nutritionSugars: "Waarvan suikers",
  nutritionFiber: "Vezels",
  nutritionProtein: "Eiwitten",
  nutritionSalt: "Zout",
};

function fieldLabel(field: CopyFieldName) {
  return fieldLabels[field];
}

function ProductNavigation({ neighbours, context, hasUnsavedWork }: {
  neighbours: ProductNeighbours | null;
  context: OverviewContext;
  hasUnsavedWork: boolean;
}) {
  if (!neighbours || neighbours.total < 2) return null;
  function guard(event: React.MouseEvent) {
    if (hasUnsavedWork && !window.confirm("Je hebt gekozen wijzigingen die nog niet zijn opgeslagen. Toch naar een ander product?")) {
      event.preventDefault();
    }
  }
  const linkClass = `${buttonClass} min-w-0 border border-border bg-surface text-text`;
  const disabledClass = `${buttonClass} min-w-0 border border-border bg-background text-muted opacity-50`;
  return (
    <nav aria-label="Andere producten" className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:items-center">
      {neighbours.previous ? (
        <Link href={productHref(neighbours.previous.id, context)} onClick={guard} className={`${linkClass} justify-start`} rel="prev">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">Vorige<span className="hidden sm:inline">: {neighbours.previous.name}</span></span>
        </Link>
      ) : <span className={`${disabledClass} justify-start`} aria-disabled="true"><ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />Vorige</span>}
      <p className="order-last col-span-2 text-center text-xs text-muted sm:order-none sm:flex-1">Product {neighbours.position} van {neighbours.total}{context.filter !== "ALL" || context.query ? " in deze selectie" : ""}</p>
      {neighbours.next ? (
        <Link href={productHref(neighbours.next.id, context)} onClick={guard} className={`${linkClass} justify-end`} rel="next">
          <span className="truncate">Volgende<span className="hidden sm:inline">: {neighbours.next.name}</span></span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      ) : <span className={`${disabledClass} justify-end`} aria-disabled="true">Volgende<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></span>}
    </nav>
  );
}

function EditorialWorkspace({ product, proposal, busy, requestStatus, generateProposal, goToNextProduct, context, neighbours, beginRequest, finishRequest, failRequest, setProposal, setProduct, showMessage, setRetry }: {
  product: CopyWriterProduct | null;
  proposal: CopyWriterProposal | null;
  busy: boolean;
  requestStatus: React.ReactNode;
  generateProposal: () => Promise<void>;
  goToNextProduct: () => void;
  context: OverviewContext;
  neighbours: ProductNeighbours | null;
  beginRequest: (text: string) => AbortController;
  finishRequest: (controller: AbortController) => void;
  failRequest: (cause: unknown, retryAction: () => void) => void;
  setProposal: (proposal: CopyWriterProposal | null) => void;
  setProduct: (product: CopyWriterProduct) => void;
  showMessage: (message: string | null) => void;
  setRetry: (retry: RetryAction) => void;
}) {
  const [decisions, setDecisions] = useState<Partial<Record<CopyFieldName, FieldDecision>>>({});
  const [edits, setEdits] = useState<Partial<Record<CopyFieldName, string>>>(() => Object.fromEntries((proposal?.fields || []).map((field) => [field.name, field.proposed || ""])));
  const [dirty, setDirty] = useState<Set<CopyFieldName>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedLabels, setSavedLabels] = useState<string[]>([]);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const editKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const applyKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    confirmButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) closeConfirmation();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen, busy]);

  const fields = proposal?.fields || [];
  const changedFields = fields.filter(isChange);
  const unchangedFields = fields.filter((field) => field.proposed !== null && field.proposed === field.current);
  const blockedFields = fields.filter((field) => !field.applyAllowed || field.proposed === null);
  const selectedCount = countSelectedChanges(fields, decisions, edits);
  const selectedFields = changedFields.filter((field) => {
    const decision = decisions[field.name];
    const next = decision === "edit" ? edits[field.name] ?? field.proposed : field.proposed;
    return (decision === "proposal" || decision === "edit") && next !== null && next !== field.current;
  });
  const stale = Boolean(proposal?.stale);
  const applied = proposal?.status === "APPLIED";
  const canSave = proposal?.status === "DRAFT" && !stale && selectedCount > 0 && !busy;
  const selectedEstimates = selectedFields.filter(isEstimate);
  const allTaken = changedFields.length > 0 && changedFields.every((field) => decisions[field.name] === "proposal" || decisions[field.name] === "edit");

  function changeDecision(field: CopyWriterField, decision: FieldDecision) {
    if (!field.applyAllowed && decision !== "keep") return;
    setDecisions((current) => ({ ...current, [field.name]: decision }));
  }

  function takeAll() {
    setDecisions((current) => ({
      ...current,
      ...Object.fromEntries(changedFields.filter((field) => current[field.name] !== "edit").map((field) => [field.name, "proposal"])),
    }));
  }

  function changeEdit(field: CopyWriterField, value: string) {
    setEdits((current) => ({ ...current, [field.name]: value }));
    setDirty((current) => new Set(current).add(field.name));
  }

  async function persistEdits() {
    const editedDirty = [...dirty].filter((name) => decisions[name] === "edit");
    if (!proposal || editedDirty.length === 0) return proposal;
    const controller = beginRequest("Aanpassingen bewaren…");
    try {
      const editPayload = Object.fromEntries(editedDirty.map((fieldName) => [fieldName, edits[fieldName] || ""]));
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
    if (!canSave) return;
    const saved = await persistEdits();
    if (!saved) return;
    setConfirmOpen(true);
  }

  function closeConfirmation() {
    setConfirmOpen(false);
    requestAnimationFrame(() => saveButtonRef.current?.focus());
  }

  async function applySelected() {
    if (!proposal || selectedCount === 0) return;
    const labels = selectedFields.map((field) => fieldLabel(field.name));
    const controller = beginRequest(`${selectedCount} ${selectedCount === 1 ? "tekst" : "teksten"} opslaan…`);
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
      const next = normalizedProposal(body);
      setSavedLabels(labels);
      setProposal(next);
      setProduct(next.product);
      setDecisions({});
      setDirty(new Set());
      setConfirmOpen(false);
      applyKeyRef.current = null;
      showMessage(`${labels.length} ${labels.length === 1 ? "tekst" : "teksten"} opgeslagen. De status is bijgewerkt: ${statusLabels[next.product.completeness]}.`);
      setRetry(null);
    } catch (cause) {
      setConfirmOpen(false);
      failRequest(cause, () => void applySelected());
    } finally {
      finishRequest(controller);
    }
  }

  async function acceptField(item: CopyWriterAttentionField) {
    if (!product) return;
    const controller = beginRequest(`${item.label} vastleggen…`);
    try {
      const body = await responseBody<{ product: CopyWriterProduct; proposal: CopyWriterProposal | null }>(await fetch(`${productsApi}/${encodeURIComponent(product.id)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: item.field }),
        signal: controller.signal,
      }));
      setProduct(body.product);
      if (proposal && body.proposal?.id === proposal.id) setProposal(body.proposal);
      showMessage(`${item.label} blijft zoals het is. Status: ${statusLabels[body.product.completeness]}.`);
      setRetry(null);
    } catch (cause) {
      failRequest(cause, () => void acceptField(item));
    } finally {
      finishRequest(controller);
    }
  }

  function requestNewProposal() {
    const hasUnsavedWork = dirty.size > 0 || selectedCount > 0;
    if (hasUnsavedWork && typeof window !== "undefined" && !window.confirm("Een nieuw voorstel vervangt dit voorstel. Je gekozen wijzigingen gaan verloren. Doorgaan?")) {
      return;
    }
    void generateProposal();
  }

  return (
    <div className="pb-40 sm:pb-28">
      <WorkspaceHeader title={product?.name || "Product laden"} description="Vergelijk de huidige tekst met het voorstel. Jij kiest per veld wat je overneemt; er verandert niets tot je opslaat." backHref={overviewHref(context)} backLabel="Alle producten" />
      <ProductNavigation neighbours={neighbours} context={context} hasUnsavedWork={!applied && (dirty.size > 0 || selectedCount > 0)} />

      {product ? (
        <section className="mt-5 grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-card sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:p-5" aria-label="Product">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border border-border bg-background">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <FilePenLine className="h-7 w-7 text-muted" aria-hidden="true" />}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(product.completeness)}`}>{statusLabels[product.completeness]}</span>{!product.active ? <span className="rounded-full bg-border px-2 py-1 text-xs font-semibold text-muted">Inactief</span> : null}</div>
            <p className="mt-2 text-xs text-muted">SKU {product.sku} · Nederlandse tekst · <Link href={productEditorHref(product.id, productHref(product.id, context))} className="font-semibold text-accent-ink underline underline-offset-4">Open in producteditor</Link></p>
          </div>
          {!proposal || applied || stale ? (
            <button type="button" disabled={busy} onClick={requestNewProposal} className={`${buttonClass} w-full bg-accent text-contrast sm:w-auto`}><Sparkles className="h-4 w-4" aria-hidden="true" />{proposal ? "Nieuw voorstel schrijven" : "Schrijf voorstel"}</button>
          ) : (
            <button type="button" disabled={busy} onClick={requestNewProposal} className={`${buttonClass} w-full border border-border bg-surface text-text sm:w-auto`}><RefreshCw className="h-4 w-4" aria-hidden="true" />Nieuw voorstel schrijven</button>
          )}
        </section>
      ) : null}

      <div className="mt-4">{requestStatus}</div>

      {product ? <AttentionPanel product={product} busy={busy} onAccept={(item) => void acceptField(item)} /> : null}

      {product && !proposal && !busy ? (
        <section className="mt-4 rounded-panel border border-dashed border-border bg-background p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="mt-3 text-heading-md text-text">Nog geen voorstel</h2>
          <p className="mx-auto mt-2 max-w-xl text-body-sm leading-6 text-muted">Gemini schrijft een voorstel op basis van de productgegevens. Er verandert niets aan de webshop tot jij velden kiest en opslaat.</p>
        </section>
      ) : null}

      {stale ? (
        <p role="alert" className="mt-4 flex flex-wrap items-center gap-2 rounded-card border border-amber-200 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900"><ShieldAlert className="h-5 w-5" aria-hidden="true" />Dit product is aangepast nadat het voorstel is geschreven. Schrijf een nieuw voorstel om verder te gaan.</p>
      ) : null}

      {applied ? (
        <section className="mt-4 rounded-panel border border-green-200 bg-green-50 p-4 sm:p-5" aria-labelledby="saved-title">
          <h2 id="saved-title" className="flex items-center gap-2 text-heading-sm font-bold text-green-900"><CheckCheck className="h-5 w-5" aria-hidden="true" />Opgeslagen</h2>
          {savedLabels.length ? <p className="mt-2 text-body-sm text-green-900">{savedLabels.join(", ")}.</p> : <p className="mt-2 text-body-sm text-green-900">Dit voorstel is opgeslagen.</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={goToNextProduct} className={`${buttonClass} bg-accent text-contrast`}>Volgend product om te doen <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            <Link href={overviewHref(context)} className={`${buttonClass} border border-green-300 bg-surface text-text`}>Terug naar overzicht</Link>
          </div>
        </section>
      ) : null}

      {proposal && !applied ? (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-heading-md text-text">{changedFields.length ? `${changedFields.length} ${changedFields.length === 1 ? "verbetering" : "verbeteringen"}` : "Geen verbeteringen"}</h2>
              <p className="mt-1 text-body-sm text-muted">{changedFields.length ? "Kies per veld: overnemen, aanpassen of laten zoals het is." : "De huidige tekst is al goed. Je hoeft niets op te slaan."}</p>
            </div>
            {changedFields.length > 1 && !stale ? (
              allTaken
                ? <button type="button" disabled={busy} onClick={() => setDecisions({})} className={`${buttonClass} border border-border bg-surface text-text`}><Undo2 className="h-4 w-4" aria-hidden="true" />Alles terugzetten</button>
                : <button type="button" disabled={busy} onClick={takeAll} className={`${buttonClass} border border-accent-ink bg-surface text-accent-ink`}><CheckCheck className="h-4 w-4" aria-hidden="true" />Alle verbeteringen overnemen ({changedFields.length})</button>
            ) : null}
          </div>

          {changedFields.map((field, index) => (
            <Fragment key={field.name}>
            {field.group !== changedFields[index - 1]?.group ? <h3 className="mt-2 font-heading text-body-md font-bold text-text">{field.group}</h3> : null}
            <EditorialFieldCard
              key={field.name}
              field={field}
              attentionItem={attention(product ?? proposal.product).find((item) => item.field === field.name)}
              decision={decisions[field.name] || "keep"}
              editedValue={edits[field.name] ?? field.proposed ?? ""}
              onDecision={(decision) => changeDecision(field, decision)}
              onEdit={(value) => changeEdit(field, value)}
              disabled={busy || stale}
            />
            </Fragment>
          ))}

          {unchangedFields.length || blockedFields.length ? (
            <section className="rounded-panel border border-border bg-surface p-4 text-body-sm shadow-card sm:p-5" aria-labelledby="unchanged-title">
              <h3 id="unchanged-title" className="font-heading text-body-md font-bold text-text">Niet aangepast</h3>
              <ul className="mt-2 grid gap-1.5 text-muted">
                {unchangedFields.map((field) => <li key={field.name}><strong className="text-text">{fieldLabel(field.name)}:</strong> blijft hetzelfde.</li>)}
                {blockedFields.map((field) => <li key={field.name}><strong className="text-text">{fieldLabel(field.name)}:</strong> {field.qualityReason}</li>)}
              </ul>
            </section>
          ) : null}

        </div>
      ) : null}

      {proposal && !applied && changedFields.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 shadow-[0_-4px_16px_rgba(20,20,20,0.12)] backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:w-[min(30rem,calc(100%-2rem))] sm:rounded-panel sm:border">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 font-heading text-body-sm font-bold text-text">{stale ? "Schrijf eerst een nieuw voorstel" : `${selectedCount} ${selectedCount === 1 ? "wijziging" : "wijzigingen"} gekozen`}</p>
            <button ref={saveButtonRef} type="button" disabled={!canSave} onClick={() => void openConfirmation()} className={`${buttonClass} bg-accent-ink text-surface`}><Save className="h-4 w-4" aria-hidden="true" />Opslaan ({selectedCount})</button>
          </div>
        </div>
      ) : null}

      {confirmOpen && proposal ? (
        <div role="presentation" className="fixed inset-0 z-50 flex items-end justify-center bg-contrast/60 sm:items-center sm:p-4">
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="copy-confirm-title" className="max-h-[100dvh] w-full overflow-y-auto rounded-t-panel border border-border bg-surface p-4 shadow-card sm:max-w-xl sm:rounded-panel sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="copy-confirm-title" className="text-heading-md text-text">{selectedCount} {selectedCount === 1 ? "tekst" : "teksten"} opslaan voor {proposal.product.name}?</h2>
              <button type="button" disabled={busy} onClick={closeConfirmation} aria-label="Sluiten" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-border text-text disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <ul className="mt-4 grid gap-2">
              {selectedFields.map((field) => (
                <li key={field.name} className="flex min-h-11 flex-wrap items-center gap-2 rounded-button border border-border px-3 py-2 text-body-sm text-text">
                  <Check className="h-4 w-4 text-accent-ink" aria-hidden="true" />{fieldLabel(field.name)}
                  {field.name === "slug" ? <span className="w-full text-xs text-amber-900">Het webadres verandert. De oude link stuurt automatisch door.</span> : null}
                  {field.name === "promotionText" && field.proposed === "" ? <span className="w-full text-xs text-muted">De actietekst wordt leeggemaakt.</span> : null}
                </li>
              ))}
            </ul>
            {selectedEstimates.length ? (
              <p role="alert" className="mt-3 flex gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm font-semibold text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Je slaat {selectedEstimates.length} {selectedEstimates.length === 1 ? "schatting" : "schattingen"} op voor productinfo ({selectedEstimates.map((field) => fieldLabel(field.name)).join(", ")}). Klanten met een allergie vertrouwen hierop: controleer ze tegen het etiket.</span>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted">Andere velden blijven zoals ze zijn.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={closeConfirmation} className={`${buttonClass} border border-border bg-surface text-text`}>Annuleren</button>
              <button ref={confirmButtonRef} type="button" disabled={busy} onClick={() => void applySelected()} className={`${buttonClass} bg-accent text-contrast`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{`Opslaan (${selectedCount})`}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function FieldValue({ field, value }: { field: CopyWriterField; value: string }) {
  if (field.name === "promotionText" && value === "") return <span className="italic text-muted">Wordt leeggemaakt</span>;
  if (!value) return <span className="italic text-muted">Leeg</span>;
  if (field.unit) return <>{value} {field.unit}</>;
  return <>{field.name === "descriptionHtml" ? plainText(value) : value}</>;
}

function EditorialFieldCard({ field, attentionItem, decision, editedValue, onDecision, onEdit, disabled }: {
  field: CopyWriterField;
  attentionItem?: CopyWriterAttentionField;
  decision: FieldDecision;
  editedValue: string;
  onDecision: (decision: FieldDecision) => void;
  onEdit: (value: string) => void;
  disabled: boolean;
}) {
  const nextValue = decision === "edit" ? editedValue : field.proposed || "";
  const proposedLength = visibleLength(nextValue);
  const tooLong = proposedLength > field.maxLength;
  const canEdit = !(field.name === "promotionText" && field.proposed === "");
  const textAreaRows = field.name === "descriptionHtml" ? 8 : field.name === "shortDescription" ? 4 : 3;
  const nutrition = isNutrition(field.name);
  const options: Array<[FieldDecision, string]> = [
    ["proposal", "Overnemen"],
    ...(canEdit ? [["edit", "Aanpassen"] as [FieldDecision, string]] : []),
    ["keep", "Laten zoals het is"],
  ];

  return (
    <article data-editorial-field={field.name} className={`min-w-0 rounded-panel border bg-surface p-4 shadow-card sm:p-5 ${decision === "keep" ? "border-border" : "border-accent-ink"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-heading-sm font-bold text-text">{fieldLabel(field.name)}</h3>
        {decision !== "keep" ? <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent-ink">Wordt opgeslagen</span> : null}
      </div>
      {attentionItem ? <p className="mt-2 text-body-sm text-amber-900">{attentionItem.reason}</p> : null}
      {isEstimate(field) ? (
        <p className="mt-2 flex gap-2 rounded-card border border-amber-300 bg-amber-50 p-2.5 text-body-sm font-semibold text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{field.warnings[0] ?? "AI-schatting. Controleer dit tegen het etiket voordat je opslaat."}
        </p>
      ) : null}
      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-card border border-border bg-background p-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Nu</h4>
          <div className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-body-sm leading-6 text-text"><FieldValue field={field} value={field.current} /></div>
        </section>
        <section className="min-w-0 rounded-card border border-accent/50 bg-accent/10 p-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Voorstel</h4>
          {decision === "edit" && nutrition ? (
            <span className="mt-2 flex items-center gap-2">
              <input value={editedValue} onChange={(event) => onEdit(event.target.value)} disabled={disabled} inputMode="decimal" maxLength={field.maxLength} className={inputClass} aria-label={`${fieldLabel(field.name)} aanpassen`} />
              <span className="shrink-0 text-body-sm text-muted">{field.unit}</span>
            </span>
          ) : decision === "edit" ? (
            <textarea value={editedValue} onChange={(event) => onEdit(event.target.value)} disabled={disabled} maxLength={field.name === "descriptionHtml" ? field.htmlMaxLength || 50000 : field.maxLength} rows={textAreaRows} className={`${inputClass} mt-2 resize-y py-3 leading-6`} aria-label={`${fieldLabel(field.name)} aanpassen`} />
          ) : (
            <div className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-body-sm leading-6 text-text"><FieldValue field={field} value={field.proposed ?? ""} /></div>
          )}
          {nextValue && !nutrition ? <p className={`mt-2 text-xs ${tooLong ? "font-bold text-red-700" : "text-muted"}`}>{proposedLength} van maximaal {field.maxLength} tekens{tooLong ? " · te lang, maak de tekst korter" : ""}</p> : null}
        </section>
      </div>
      {field.name === "slug" ? <p className="mt-3 text-xs text-amber-900">Overnemen verandert het webadres. De oude link stuurt automatisch door.</p> : null}
      <fieldset className="mt-4" disabled={disabled}>
        <legend className="sr-only">Wat wil je met {fieldLabel(field.name)}?</legend>
        <div className={`grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {options.map(([value, label]) => (
            <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3 text-body-sm font-semibold ${decision === value ? "border-accent-ink bg-accent/15 text-text" : "border-border bg-surface text-muted"}`}>
              <input type="radio" name={`decision-${field.name}`} value={value} checked={decision === value} onChange={() => onDecision(value)} />{label}
            </label>
          ))}
        </div>
      </fieldset>
    </article>
  );
}
