"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, ImagePlus, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { CanvaPicker } from "@/components/admin-panel/canva/CanvaPicker";
import { geminiImageModels, type GeminiImageJobInput } from "@/lib/design-studio/gemini-image-schema";
import type { DesignAssetDto, DesignStudioProduct, GeminiImageAvailability } from "@/lib/design-studio/types";

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text outline-none focus:border-accent-ink focus:ring-2 focus:ring-accent/30 md:text-body-sm";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type ApiError = { error?: string; message?: string };
type GeminiProviderStatus = GeminiImageAvailability["status"] | "checking";

class ApiResponseError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiResponseError";
  }
}

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ApiError) | null;
  if (!response.ok) throw new ApiResponseError(body?.message || "De aanvraag is niet gelukt.", response.status, body?.error);
  if (!body) throw new Error("De server retourneerde geen geldig antwoord.");
  return body;
}

async function requestGeminiAvailability(signal?: AbortSignal): Promise<GeminiImageAvailability> {
  const response = await fetch("/api/admin/design-studio/gemini-image/status", { signal, cache: "no-store" });
  return responseBody<GeminiImageAvailability>(response);
}

function initialSelection(products: DesignStudioProduct[], productId?: string, imageId?: string) {
  const product = products.find((item) => item.id === productId) || products[0];
  const image = product?.images.find((item) => item.id === imageId) || product?.images.find((item) => item.isPrimary) || product?.images[0];
  return { productId: product?.id || "", imageId: image?.id || "" };
}

export function GeminiImageWorkspace({
  initialProducts,
  initialAssets,
  initialProductId,
  initialImageId,
  configured,
  allowed,
  showNavigation = true,
}: {
  initialProducts: DesignStudioProduct[];
  initialAssets: DesignAssetDto[];
  initialProductId?: string;
  initialImageId?: string;
  configured: boolean;
  allowed: boolean;
  showNavigation?: boolean;
}) {
  const initial = initialSelection(initialProducts, initialProductId, initialImageId);
  const [products, setProducts] = useState(initialProducts);
  const [productId, setProductId] = useState(initial.productId);
  const [imageId, setImageId] = useState(initial.imageId);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets.find((asset) => asset.productId === initial.productId)?.id || "");
  const [modelId, setModelId] = useState<GeminiImageJobInput["modelId"]>("gemini-3.1-flash-image");
  const [preset, setPreset] = useState<GeminiImageJobInput["preset"]>("catalog");
  const [aspectRatio, setAspectRatio] = useState<GeminiImageJobInput["aspectRatio"]>("1:1");
  const [imageSize, setImageSize] = useState<GeminiImageJobInput["imageSize"]>("1K");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<GeminiProviderStatus>(configured ? "checking" : "not_configured");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const idempotencyKey = useRef<string | null>(null);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedImage = selectedProduct?.images.find((image) => image.id === imageId);
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const productAssets = useMemo(() => assets.filter((asset) => asset.productId === productId), [assets, productId]);
  const selectedModelAvailable = providerStatus !== "ready" || availableModels.length === 0 || availableModels.includes(modelId);
  const canRun = providerStatus === "ready" && selectedModelAvailable && allowed && Boolean(selectedImage) && !busy;

  async function checkProviderStatus() {
    try {
      const availability = await requestGeminiAvailability();
      setProviderStatus(availability.status);
      setAvailableModels(availability.availableModels);
    } catch {
      setProviderStatus("unavailable");
      setAvailableModels([]);
    }
  }

  useEffect(() => {
    if (!configured || !allowed) return;
    const controller = new AbortController();
    void requestGeminiAvailability(controller.signal)
      .then((availability) => {
        setProviderStatus(availability.status);
        setAvailableModels(availability.availableModels);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setProviderStatus("unavailable");
        setAvailableModels([]);
      });
    return () => controller.abort();
  }, [allowed, configured]);

  const providerBadge = !allowed && configured
    ? { className: "bg-slate-100 text-slate-700", label: "Gemini ingesteld" }
    : providerStatus === "ready"
      ? { className: "bg-green-100 text-green-800", label: "Gemini klaar" }
      : providerStatus === "checking"
        ? { className: "bg-slate-100 text-slate-700", label: "Gemini controleren" }
        : providerStatus === "invalid_configuration"
          ? { className: "bg-red-50 text-red-800", label: "Gemini-sleutel geweigerd" }
          : providerStatus === "unavailable"
            ? { className: "bg-red-50 text-red-800", label: "Gemini niet bereikbaar" }
            : { className: "bg-red-50 text-red-800", label: "Gemini niet geconfigureerd" };

  function changeRequestInput(update: () => void) {
    idempotencyKey.current = null;
    update();
    setError(null);
    setMessage(null);
  }

  function chooseProduct(nextId: string) {
    const product = products.find((item) => item.id === nextId);
    const image = product?.images.find((item) => item.isPrimary) || product?.images[0];
    setProductId(nextId);
    setImageId(image?.id || "");
    setSelectedAssetId(assets.find((asset) => asset.productId === nextId)?.id || "");
    idempotencyKey.current = null;
    setError(null);
    setMessage(null);
  }

  async function uploadSource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProduct) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", selectedProduct.name);
      const response = await fetch(`/api/admin/products/${selectedProduct.id}/images`, { method: "POST", body: form });
      const body = await responseBody<{ image: DesignStudioProduct["images"][number] }>(response);
      setProducts((current) => current.map((product) => product.id === selectedProduct.id ? { ...product, images: [...product.images, body.image] } : product));
      changeRequestInput(() => setImageId(body.image.id));
      setMessage("Bronafbeelding toegevoegd en geselecteerd.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uploaden is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    if (!selectedImage || !selectedProduct) return;
    setBusy(true);
    setError(null);
    setMessage("Gemini maakt een productgetrouw concept. Dit kan één tot twee minuten duren.");
    idempotencyKey.current ||= `gemini-image:${crypto.randomUUID()}`;
    try {
      const response = await fetch("/api/admin/design-studio/gemini-image/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({ productId: selectedProduct.id, imageId: selectedImage.id, modelId, preset, aspectRatio, imageSize, brief }),
      });
      const body = await responseBody<{ asset: DesignAssetDto; attemptsUsed: number; dailyLimit: number }>(response);
      idempotencyKey.current = null;
      setAssets((current) => [body.asset, ...current.filter((asset) => asset.id !== body.asset.id)]);
      setSelectedAssetId(body.asset.id);
      setMessage(`Gemini-concept klaar. Gebruik ${body.attemptsUsed} van maximaal ${body.dailyLimit} aanvragen vandaag.`);
    } catch (cause) {
      if (cause instanceof ApiResponseError && (cause.status < 500 || cause.code === "NOT_CONFIGURED" || cause.code === "INVALID_CONFIGURATION")) {
        idempotencyKey.current = null;
      }
      setError(cause instanceof Error ? cause.message : "Gemini kon het concept niet maken.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(asset: DesignAssetDto) {
    if (asset.status === "PUBLISHED") return;
    if (!window.confirm("Dit Gemini-concept als nieuwe, niet-primaire productafbeelding toevoegen? Het origineel blijft ongewijzigd.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/design-studio/jobs/${asset.jobId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const body = await responseBody<{ asset: DesignAssetDto }>(response);
      setAssets((current) => current.map((item) => item.id === body.asset.id ? body.asset : item));
      setMessage("Gemini-resultaat toegevoegd als nieuwe, niet-primaire productafbeelding.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publiceren is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {showNavigation ? <Link href="/admin/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Design Studio</Link> : null}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Productfoto’s · Gemini</p>
          <h1 className="mt-2 text-heading-xl text-text">Realistische productfoto’s en campagnebeelden</h1>
          <p className="mt-2 text-body-sm leading-6 text-muted">Gebruik een bestaande productfoto als vaste bron. Gemini maakt een concept; verpakking, etiket, logo, kleur en productvorm moeten herkenbaar gelijk blijven.</p>
        </div>
        <span role="status" aria-live="polite" className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-body-sm font-bold ${providerBadge.className}`}><ShieldCheck className="h-4 w-4" aria-hidden="true" />{providerBadge.label}</span>
      </div>

      {!allowed ? <div role="alert" className="mt-6 rounded-card border border-amber-300 bg-amber-50 p-4 text-body-sm font-semibold text-amber-900">Alleen een owner of admin kan Gemini-beelden maken en publiceren.</div> : null}
      {allowed && (providerStatus === "invalid_configuration" || providerStatus === "unavailable") ? <div role="alert" className="mt-6 rounded-card border border-red-200 bg-red-50 p-4 text-body-sm font-semibold text-red-800">Gemini Image is nu niet beschikbaar. Je kunt intussen <Link href="/admin/design-studio/productfotos?provider=photoroom" className="underline underline-offset-4">PhotoRoom gebruiken</Link>.</div> : null}
      <div aria-live="polite" className="mt-4 min-h-6 text-body-sm">{busy ? <p className="font-semibold text-muted">Gemini verwerkt het beeld veilig…</p> : error ? <p role="alert" className="font-semibold text-red-700">{error}</p> : message ? <p className="font-semibold text-green-700">{message}</p> : null}</div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-label="Gemini-instellingen">
          <h2 className="text-heading-md text-text">1. Kies je bron</h2>
          <label className="mt-4 block text-body-sm font-semibold text-text">Product
            <select value={productId} onChange={(event) => chooseProduct(event.target.value)} className={inputClass}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          </label>
          {selectedProduct ? <div className="mt-4 grid grid-cols-3 gap-2">{selectedProduct.images.map((image, index) => <button key={image.id} type="button" onClick={() => changeRequestInput(() => setImageId(image.id))} aria-pressed={image.id === imageId} className={`relative min-h-11 overflow-hidden rounded-button border p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${image.id === imageId ? "border-accent-ink ring-2 ring-accent/30" : "border-border"}`}><img src={image.url} alt={image.alt || `${selectedProduct.name}, foto ${index + 1}`} className="aspect-square w-full rounded object-contain" />{image.isPrimary ? <span className="absolute bottom-1 left-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-bold text-text">Primair</span> : null}</button>)}</div> : <p className="mt-4 text-body-sm text-muted">Geen productafbeeldingen beschikbaar.</p>}
          <label className={`${buttonClass} mt-3 w-full cursor-pointer border border-border bg-surface text-text focus-within:ring-2 focus-within:ring-accent-ink`}><ImagePlus className="h-4 w-4" aria-hidden="true" />Bron uploaden<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!allowed || busy || !selectedProduct} onChange={uploadSource} className="sr-only" /></label>

          <h2 className="mt-7 border-t border-border pt-6 text-heading-md text-text">2. Kies kwaliteit</h2>
          <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Gemini-model">
            {geminiImageModels.map((model) => {
              const modelAvailable = providerStatus !== "ready" || availableModels.length === 0 || availableModels.includes(model.id);
              return <label key={model.id} className={`rounded-card border p-3 transition-colors ${modelAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${modelId === model.id ? "border-accent-ink bg-accent/10" : "border-border hover:border-border-hover"}`}><input type="radio" name="gemini-image-model" value={model.id} checked={modelId === model.id} disabled={!modelAvailable} onChange={() => changeRequestInput(() => setModelId(model.id))} className="sr-only" /><span className="flex items-start justify-between gap-3"><span><span className="block font-heading text-body-sm font-bold text-text">{model.name}</span><span className="mt-1 block text-xs leading-5 text-muted">{model.description}</span></span>{modelId === model.id ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" /> : null}</span><span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{modelAvailable ? model.priceHint : "Niet beschikbaar voor deze sleutel"}</span></label>;
            })}
          </div>

          <h2 className="mt-7 border-t border-border pt-6 text-heading-md text-text">3. Geef richting</h2>
          <label className="mt-4 block text-body-sm font-semibold text-text">Soort beeld
            <select value={preset} onChange={(event) => changeRequestInput(() => setPreset(event.target.value as typeof preset))} className={inputClass}><option value="catalog">Realistische studio-productfoto</option><option value="editorial">Editorial productbeeld</option><option value="lifestyle">Warm gebruiksmoment</option><option value="seasonal">Seizoenscampagne</option><option value="social">Social post</option><option value="hero">Brede homepagebanner</option></select>
          </label>
          <label className="mt-4 block text-body-sm font-semibold text-text">Formaat
            <select value={aspectRatio} onChange={(event) => changeRequestInput(() => setAspectRatio(event.target.value as typeof aspectRatio))} className={inputClass}><option value="1:1">Vierkant · 1:1</option><option value="4:5">Staand · 4:5</option><option value="16:9">Breed · 16:9</option><option value="9:16">Story · 9:16</option></select>
          </label>
          <label className="mt-4 block text-body-sm font-semibold text-text">Resolutie
            <select value={imageSize} onChange={(event) => changeRequestInput(() => setImageSize(event.target.value as typeof imageSize))} className={inputClass}><option value="1K">1K · voordeliger</option><option value="2K">2K · scherper en duurder</option></select>
          </label>
          <label className="mt-4 block text-body-sm font-semibold text-text">Aanvullende briefing <span className="font-normal text-muted">(optioneel)</span>
            <textarea value={brief} onChange={(event) => changeRequestInput(() => setBrief(event.target.value))} maxLength={800} rows={4} placeholder="Bijvoorbeeld: zomeravond op een houten borreltafel, product rechts en rustige ruimte links." className={`${inputClass} min-h-28 py-3 leading-6`} />
          </label>
          <p className="mt-2 text-xs text-muted">{brief.length}/800 · Laat prijs, slogan en definitieve merktekst later in Canva toevoegen.</p>
          <button type="button" disabled={!canRun} onClick={() => void generateDraft()} className={`${buttonClass} mt-6 w-full bg-accent-ink text-white hover:bg-accent-ink/90`}><WandSparkles className="h-4 w-4" aria-hidden="true" />Gemini-concept maken</button>
          <p className="mt-3 text-xs leading-5 text-muted">{providerStatus !== "ready" ? `${providerBadge.label}. ` : ""}Dit start een betaalde Gemini-aanvraag. Maximaal 25 aanvragen per Amsterdamse kalenderdag.</p>
          {allowed && (providerStatus === "invalid_configuration" || providerStatus === "unavailable") ? <button type="button" onClick={() => { setProviderStatus("checking"); void checkProviderStatus(); }} disabled={busy} className={`${buttonClass} mt-2 w-full border border-border bg-surface text-text hover:border-border-hover`}>Gemini-status opnieuw controleren</button> : null}
        </aside>

        <section className="min-w-0" aria-labelledby="gemini-preview-heading">
          <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Controle voor gebruik</p><h2 id="gemini-preview-heading" className="mt-1 text-heading-md text-text">Bron en Gemini-concept</h2></div><Sparkles className="h-6 w-6 text-accent-ink" aria-hidden="true" /></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <figure className="min-w-0"><div className="overflow-hidden rounded-card border border-border bg-background p-3">{selectedImage ? <img src={selectedImage.url} alt={`Originele bron voor ${selectedProduct?.name || "product"}`} className="aspect-square w-full object-contain" /> : <div className="flex aspect-square items-center justify-center px-6 text-center text-body-sm text-muted">Kies eerst een bronafbeelding.</div>}</div><figcaption className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">Voor · origineel</figcaption></figure>
              <figure className="min-w-0"><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-card border border-border bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3">{selectedAsset ? <img src={selectedAsset.url} alt={`Gemini-concept voor ${selectedProduct?.name || "product"}`} className="max-h-[40rem] w-full object-contain" /> : <div className="flex min-h-64 items-center justify-center bg-surface/80 px-6 text-center text-body-sm text-muted">Hier verschijnt het nieuwe Gemini-concept.</div>}</div><figcaption className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">Na · concept</figcaption></figure>
            </div>
            {selectedAsset ? <button type="button" disabled={busy || selectedAsset.status !== "DRAFT" || !allowed} onClick={() => void publish(selectedAsset)} className={`${buttonClass} mt-6 w-full bg-accent-ink text-white`}>{selectedAsset.status === "PUBLISHED" ? <><Check className="h-4 w-4" />Al toegevoegd</> : "Als nieuwe productfoto toevoegen"}</button> : null}
            {selectedAsset ? <div className="mt-3"><CanvaPicker sourceImageUrl={selectedAsset.url} defaultSize="product" designTitle={`${selectedProduct?.name || "Product"} · Gemini`} label="Tekst en huisstijl toevoegen in Canva" className={`${buttonClass} w-full border border-border bg-surface text-text`} onSelect={() => setMessage("De Canva-versie staat in Marketing → Mediabibliotheek.")} /></div> : null}
          </div>

          <div className="mt-6 rounded-panel border border-border bg-surface p-4 sm:p-6">
            <h2 className="text-heading-md text-text">Recente Gemini-concepten</h2>
            {productAssets.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{productAssets.map((asset) => <button key={asset.id} type="button" aria-pressed={selectedAssetId === asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`relative min-h-11 overflow-hidden rounded-card border p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${selectedAssetId === asset.id ? "border-accent-ink ring-2 ring-accent/30" : "border-border"}`}><img src={asset.url} alt={`Gemini-concept van ${new Date(asset.createdAt).toLocaleDateString("nl-NL")}`} className="aspect-square w-full object-contain" /><span className="mt-2 block truncate text-xs font-semibold text-text">{asset.status === "PUBLISHED" ? "Productbeeld" : "Concept"}</span></button>)}</div> : <p className="mt-3 text-body-sm text-muted">Voor dit product zijn nog geen Gemini-concepten gemaakt.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
