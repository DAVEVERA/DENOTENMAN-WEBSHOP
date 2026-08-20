"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, ImagePlus, ShieldCheck, Sparkles } from "lucide-react";
import type { DesignAssetDto, DesignStudioProduct, PhotoRoomJobInput } from "@/lib/design-studio/photoroom-schema";

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-body-sm text-text";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type ApiError = { error?: string; message?: string };

class ApiResponseError extends Error {}

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ApiError) | null;
  if (!response.ok) throw new ApiResponseError(body?.message || "De aanvraag is niet gelukt.");
  if (!body) throw new Error("De server retourneerde geen geldig antwoord.");
  return body;
}

function initialSelection(products: DesignStudioProduct[], productId?: string, imageId?: string) {
  const product = products.find((item) => item.id === productId) || products[0];
  const image = product?.images.find((item) => item.id === imageId) || product?.images.find((item) => item.isPrimary) || product?.images[0];
  return { productId: product?.id || "", imageId: image?.id || "" };
}

export function PhotoRoomWorkspace({
  initialProducts,
  initialAssets,
  initialProductId,
  initialImageId,
  configured,
  allowed,
}: {
  initialProducts: DesignStudioProduct[];
  initialAssets: DesignAssetDto[];
  initialProductId?: string;
  initialImageId?: string;
  configured: boolean;
  allowed: boolean;
}) {
  const initial = initialSelection(initialProducts, initialProductId, initialImageId);
  const [products, setProducts] = useState(initialProducts);
  const [productId, setProductId] = useState(initial.productId);
  const [imageId, setImageId] = useState(initial.imageId);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets.find((asset) => asset.productId === initial.productId)?.id || "");
  const [background, setBackground] = useState<PhotoRoomJobInput["background"]>("white");
  const [customColor, setCustomColor] = useState("#F6F3EE");
  const [format, setFormat] = useState<PhotoRoomJobInput["format"]>("square");
  const [padding, setPadding] = useState<PhotoRoomJobInput["padding"]>(0.1);
  const [softShadow, setSoftShadow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedImage = selectedProduct?.images.find((image) => image.id === imageId);
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const productAssets = useMemo(() => assets.filter((asset) => asset.productId === productId), [assets, productId]);
  const canRun = configured && allowed && Boolean(selectedImage) && !busy;

  function changeRequestInput(update: () => void) {
    idempotencyKey.current = null;
    update();
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
    setMessage(null);
    idempotencyKey.current ||= `photoroom:${crypto.randomUUID()}`;
    try {
      const response = await fetch("/api/admin/design-studio/photoroom/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({ productId: selectedProduct.id, imageId: selectedImage.id, background, ...(background === "custom" ? { customColor } : {}), format, padding, softShadow }),
      });
      const body = await responseBody<{ asset: DesignAssetDto; attemptsUsed: number; dailyLimit: number }>(response);
      idempotencyKey.current = null;
      setAssets((current) => [body.asset, ...current.filter((asset) => asset.id !== body.asset.id)]);
      setSelectedAssetId(body.asset.id);
      setMessage(`Concept gemaakt. Gebruik ${body.attemptsUsed} van maximaal ${body.dailyLimit} PhotoRoom-aanvragen vandaag.`);
    } catch (cause) {
      if (cause instanceof ApiResponseError) idempotencyKey.current = null;
      setError(cause instanceof Error ? cause.message : "De bewerking is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(asset: DesignAssetDto) {
    if (asset.status === "PUBLISHED") return;
    if (!window.confirm("Dit concept als nieuwe, niet-primaire productafbeelding toevoegen? Het origineel blijft ongewijzigd.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/design-studio/photoroom/jobs/${asset.jobId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const body = await responseBody<{ asset: DesignAssetDto }>(response);
      setAssets((current) => current.map((item) => item.id === body.asset.id ? body.asset : item));
      setMessage("Resultaat toegevoegd als nieuwe, niet-primaire productafbeelding.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publiceren is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href="/admin/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-button font-heading text-body-sm font-bold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Design Studio</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Productfoto’s · PhotoRoom</p>
          <h1 className="mt-2 text-heading-xl text-text">Van bron naar verkoopbeeld</h1>
          <p className="mt-2 text-body-sm leading-6 text-muted">Kies een bestaande foto, maak een concept en publiceer pas na controle. Geen enkele stap overschrijft de bron.</p>
        </div>
        <span className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-body-sm font-bold ${configured ? "bg-green-100 text-green-800" : "bg-red-50 text-red-800"}`}><ShieldCheck className="h-4 w-4" aria-hidden="true" />{configured ? "PhotoRoom verbonden" : "PhotoRoom niet geconfigureerd"}</span>
      </div>

      {!allowed ? <div role="alert" className="mt-6 rounded-card border border-amber-300 bg-amber-50 p-4 text-body-sm font-semibold text-amber-900">Alleen een owner of admin kan PhotoRoom-bewerkingen starten en publiceren.</div> : null}
      <div aria-live="polite" className="mt-4 min-h-6 text-body-sm">{busy ? <p className="font-semibold text-muted">Bezig met veilig verwerken…</p> : error ? <p role="alert" className="font-semibold text-red-700">{error}</p> : message ? <p className="font-semibold text-green-700">{message}</p> : null}</div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5" aria-label="Bewerkingsinstellingen">
          <h2 className="text-heading-md text-text">1. Bron en uitsnede</h2>
          <label className="mt-4 block text-body-sm font-semibold text-text">Product
            <select value={productId} onChange={(event) => chooseProduct(event.target.value)} className={inputClass}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          {selectedProduct ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {selectedProduct.images.map((image, index) => (
                <button key={image.id} type="button" onClick={() => changeRequestInput(() => setImageId(image.id))} aria-pressed={image.id === imageId} className={`relative min-h-11 overflow-hidden rounded-button border p-1 ${image.id === imageId ? "border-accent-ink ring-2 ring-accent/30" : "border-border"}`}>
                  <img src={image.url} alt={image.alt || `${selectedProduct.name}, foto ${index + 1}`} className="aspect-square w-full rounded object-contain" />
                  {image.isPrimary ? <span className="absolute bottom-1 left-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-bold text-text">Primair</span> : null}
                </button>
              ))}
            </div>
          ) : <p className="mt-4 text-body-sm text-muted">Geen productafbeeldingen beschikbaar.</p>}
          <label className={`${buttonClass} mt-3 w-full cursor-pointer border border-border bg-surface text-text focus-within:ring-2 focus-within:ring-accent-ink`}><ImagePlus className="h-4 w-4" aria-hidden="true" />Bron uploaden<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!allowed || busy || !selectedProduct} onChange={uploadSource} className="sr-only" /></label>

          <h2 className="mt-7 border-t border-border pt-6 text-heading-md text-text">2. Afwerking</h2>
          <label className="mt-4 block text-body-sm font-semibold text-text">Achtergrond
            <select value={background} onChange={(event) => changeRequestInput(() => setBackground(event.target.value as typeof background))} className={inputClass}><option value="transparent">Transparant</option><option value="white">Wit</option><option value="brand">Merkneutraal</option><option value="custom">Eigen kleur</option></select>
          </label>
          {background === "custom" ? <label className="mt-4 block text-body-sm font-semibold text-text">Eigen kleur<input type="color" value={customColor} onChange={(event) => changeRequestInput(() => setCustomColor(event.target.value))} className={`${inputClass} p-1`} /></label> : null}
          <label className="mt-4 block text-body-sm font-semibold text-text">Formaat
            <select value={format} onChange={(event) => changeRequestInput(() => setFormat(event.target.value as typeof format))} className={inputClass}><option value="square">Vierkant · 1200 × 1200</option><option value="portrait">Staand · 1200 × 1500</option></select>
          </label>
          <label className="mt-4 block text-body-sm font-semibold text-text">Ruimte rond product
            <select value={padding} onChange={(event) => changeRequestInput(() => setPadding(Number(event.target.value) as typeof padding))} className={inputClass}><option value="0.05">Compact · 5%</option><option value="0.1">Normaal · 10%</option><option value="0.15">Ruim · 15%</option><option value="0.2">Extra ruim · 20%</option></select>
          </label>
          <label className="mt-4 flex min-h-11 items-center gap-3 rounded-button border border-border px-3 text-body-sm font-semibold text-text"><input type="checkbox" checked={softShadow} onChange={(event) => changeRequestInput(() => setSoftShadow(event.target.checked))} />Zachte productschaduw</label>
          <button type="button" onClick={() => void generateDraft()} disabled={!canRun} className={`${buttonClass} mt-6 w-full bg-accent text-contrast shadow-button hover:bg-accent-hover`}><Sparkles className="h-4 w-4" aria-hidden="true" />Concept maken</button>
          <p className="mt-3 text-xs leading-5 text-muted">Maximaal 25 providerpogingen per kalenderdag. De teller gebruikt Nederlandse tijd.</p>
        </aside>

        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="preview-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="preview-title" className="text-heading-md text-text">3. Vergelijk en keur goed</h2><p className="mt-1 text-body-sm text-muted">Het rechterbeeld blijft concept tot je het expliciet toevoegt.</p></div>{selectedAsset?.status === "PUBLISHED" ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800"><Check className="h-3.5 w-3.5" />Toegevoegd</span> : null}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <figure className="min-w-0"><div className="overflow-hidden rounded-card border border-border bg-background p-3">{selectedImage ? <img src={selectedImage.url} alt={selectedImage.alt || `${selectedProduct?.name} bron`} className="aspect-square w-full object-contain" /> : <div className="flex aspect-square items-center justify-center text-body-sm text-muted">Kies een bron</div>}</div><figcaption className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">Voor · origineel</figcaption></figure>
            <div className="hidden h-px w-10 border-t-2 border-dashed border-accent-ink md:block" aria-hidden="true" />
            <figure className="min-w-0"><div className="overflow-hidden rounded-card border border-border bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3">{selectedAsset ? <img src={selectedAsset.url} alt={`PhotoRoom-concept voor ${selectedProduct?.name || "product"}`} className="aspect-square w-full object-contain" /> : <div className="flex aspect-square items-center justify-center bg-surface/80 px-6 text-center text-body-sm text-muted">Hier verschijnt het nieuwe concept.</div>}</div><figcaption className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">Na · concept</figcaption></figure>
          </div>
          {selectedAsset ? <button type="button" onClick={() => void publish(selectedAsset)} disabled={busy || selectedAsset.status !== "DRAFT" || !allowed} className={`${buttonClass} mt-6 bg-text text-surface hover:bg-contrast`}>{selectedAsset.status === "PUBLISHED" ? <><Check className="h-4 w-4" />Al toegevoegd</> : "Als nieuwe productfoto toevoegen"}</button> : null}

          {productAssets.length > 1 ? <div className="mt-8 border-t border-border pt-6"><h3 className="text-heading-sm text-text">Eerdere resultaten voor dit product</h3><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{productAssets.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedAssetId(asset.id)} aria-pressed={asset.id === selectedAssetId} className={`min-h-11 rounded-button border p-1 ${asset.id === selectedAssetId ? "border-accent-ink ring-2 ring-accent/30" : "border-border"}`}><img src={asset.url} alt="Eerder Studio-resultaat" className="aspect-square w-full rounded object-contain" /></button>)}</div></div> : null}
        </section>
      </div>
    </div>
  );
}
