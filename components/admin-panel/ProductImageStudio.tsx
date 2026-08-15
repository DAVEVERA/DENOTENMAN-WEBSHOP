"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Save,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

export type ProductImageStudioImage = {
  id: string;
  url: string;
  storageKey?: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type StudioOperation =
  | "generate"
  | "edit"
  | "extend"
  | "fill"
  | "crop"
  | "resize"
  | "remove_background"
  | "text_label"
  | "icon";

type ImagesResponse = {
  images: ProductImageStudioImage[];
  expectedImageIds: string[];
};

type StudioResponse = {
  image: ProductImageStudioImage;
  versionOf: string | null;
};

type ErrorResponse = { error?: string; message?: string };

const operations: Array<{ value: StudioOperation; label: string; ai: boolean }> = [
  { value: "generate", label: "Nieuwe productfoto genereren", ai: true },
  { value: "edit", label: "Foto aanpassen met AI", ai: true },
  { value: "extend", label: "Canvas uitbreiden met AI", ai: true },
  { value: "fill", label: "Gebied vullen met AI", ai: true },
  { value: "crop", label: "Bijsnijden", ai: false },
  { value: "resize", label: "Formaat wijzigen", ai: false },
  { value: "remove_background", label: "Achtergrond verwijderen", ai: false },
  { value: "text_label", label: "Tekstlabel toevoegen", ai: false },
  { value: "icon", label: "Icoon toevoegen", ai: false },
];

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-body-sm text-text";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border px-3 text-body-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function canonical(images: ProductImageStudioImage[]): ProductImageStudioImage[] {
  return [...images]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((image, sortOrder) => ({ ...image, sortOrder }));
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & ErrorResponse) | null;
  if (!response.ok) {
    throw new Error(body?.message || body?.error || "De beeldbewerking is niet gelukt.");
  }
  if (!body) throw new Error("De server retourneerde geen geldig antwoord.");
  return body;
}

export function ProductImageStudio({
  productId,
  productName,
  initialImages,
  onImagesChange,
}: {
  productId: string;
  productName: string;
  initialImages: ProductImageStudioImage[];
  onImagesChange?: (images: ProductImageStudioImage[]) => void;
}) {
  const [images, setImagesState] = useState(() => canonical(initialImages));
  const [selectedImageId, setSelectedImageId] = useState(initialImages[0]?.id ?? "");
  const [operation, setOperation] = useState<StudioOperation>("edit");
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [text, setText] = useState("");
  const [color, setColor] = useState("#111111");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const selected = images.find((image) => image.id === selectedImageId) ?? images[0];
  const operationInfo = operations.find((item) => item.value === operation)!;
  const needsSource = operation !== "generate";
  const needsPrompt = operationInfo.ai;
  const usesDimensions = ["generate", "edit", "extend", "fill", "crop", "resize"].includes(operation);
  const usesCoordinates = ["fill", "crop", "text_label", "icon"].includes(operation);

  const setImages = (next: ProductImageStudioImage[]) => {
    const normalized = canonical(next);
    setImagesState(normalized);
    onImagesChange?.(normalized);
    if (!normalized.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(normalized[0]?.id ?? "");
    }
  };

  const primaryId = useMemo(
    () => images.find((image) => image.isPrimary)?.id ?? images[0]?.id,
    [images]
  );

  async function refreshImages() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/images`, { cache: "no-store" });
      const body = await responseJson<ImagesResponse>(response);
      setImages(body.images);
      setMessage("Afbeeldingen zijn bijgewerkt.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Afbeeldingen vernieuwen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(next: ProductImageStudioImage[], nextPrimaryId = primaryId) {
    if (!nextPrimaryId) return;
    const previous = images;
    const ordered = canonical(next).map((image) => ({ ...image, isPrimary: image.id === nextPrimaryId }));
    setImages(ordered);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/images/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedImageIds: previous.map((image) => image.id),
          orderedImageIds: ordered.map((image) => image.id),
          primaryImageId: nextPrimaryId,
        }),
      });
      const body = await responseJson<ImagesResponse>(response);
      setImages(body.images);
      setMessage("Afbeeldingsvolgorde opgeslagen.");
    } catch (cause) {
      setImages(previous);
      setError(cause instanceof Error ? cause.message : "De volgorde kon niet worden opgeslagen.");
    } finally {
      setBusy(false);
    }
  }

  function move(imageId: string, delta: number) {
    const from = images.findIndex((image) => image.id === imageId);
    const to = Math.max(0, Math.min(images.length - 1, from + delta));
    if (from < 0 || from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  function dropOn(targetId: string) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const from = images.findIndex((image) => image.id === sourceId);
    const to = images.findIndex((image) => image.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", productName);
      const response = await fetch(`/api/admin/products/${productId}/images`, { method: "POST", body: form });
      const body = await responseJson<{ image: ProductImageStudioImage }>(response);
      setImages([...images, body.image]);
      setSelectedImageId(body.image.id);
      setMessage("Afbeelding toegevoegd als nieuwe versie.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uploaden is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAlt(image: ProductImageStudioImage) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alt: image.alt?.trim() || null }),
      });
      await responseJson<ImagesResponse>(response);
      setMessage("Alt-tekst opgeslagen.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Alt-tekst opslaan is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: ProductImageStudioImage) {
    if (!window.confirm(`Afbeelding ${image.sortOrder + 1} naar de herstelbare prullenbak verplaatsen?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "DELETE" });
      const body = await responseJson<ImagesResponse>(response);
      setImages(body.images);
      setMessage("Afbeelding naar de herstelbare prullenbak verplaatst.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verwijderen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function runStudio() {
    if (needsSource && !selected) {
      setError("Kies eerst een bronafbeelding.");
      return;
    }
    if (needsPrompt && prompt.trim().length < 3) {
      setError("Beschrijf de gewenste aanpassing in minimaal drie tekens.");
      return;
    }

    const sourceImageId = selected?.id;
    let body: Record<string, unknown>;
    if (operation === "generate") body = { operation, prompt: prompt.trim(), width, height, quality };
    else if (operation === "edit") body = { operation, sourceImageId, prompt: prompt.trim(), width, height, quality };
    else if (operation === "extend") body = { operation, sourceImageId, prompt: prompt.trim(), width, height, quality, anchor: "center" };
    else if (operation === "fill") body = { operation, sourceImageId, prompt: prompt.trim(), x, y, width, height, quality };
    else if (operation === "crop") body = { operation, sourceImageId, x, y, width, height };
    else if (operation === "resize") body = { operation, sourceImageId, width, height, fit: "contain" };
    else if (operation === "remove_background") body = { operation, sourceImageId, tolerance: 24 };
    else if (operation === "text_label") body = { operation, sourceImageId, text, x, y, fontSize: 32, color };
    else body = { operation, sourceImageId, icon: "leaf", x, y, size: 64, color };

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/images/studio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await responseJson<StudioResponse>(response);
      setImages([...images, result.image]);
      setSelectedImageId(result.image.id);
      setMessage("Nieuwe niet-destructieve versie toegevoegd. De bron is ongewijzigd.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De beeldbewerking is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="product-image-studio-title" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="product-image-studio-title" className="text-heading-md text-text">Beeldstudio</h2>
          <p className="mt-1 max-w-3xl text-body-sm text-muted">Sleep foto&apos;s in de juiste volgorde, kies één primaire foto en maak altijd een nieuwe versie bij een bewerking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refreshImages()} disabled={busy} className={buttonClass}>Vernieuwen</button>
          <label className={`${buttonClass} cursor-pointer bg-accent text-contrast focus-within:outline-none focus-within:ring-2 focus-within:ring-accent-hover focus-within:ring-offset-2`}>
            <ImagePlus className="h-4 w-4" /> Uploaden
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={upload} disabled={busy} className="sr-only" />
          </label>
        </div>
      </div>

      <div aria-live="polite" className="mt-3 min-h-6 text-body-sm">
        {busy ? <p className="font-semibold text-muted">Bezig&hellip;</p> : error ? <p className="font-semibold text-red-700">{error}</p> : message ? <p className="font-semibold text-green-700">{message}</p> : null}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.length === 0 ? (
          <div className="sm:col-span-2 xl:col-span-3 rounded-card border border-dashed border-border bg-background p-6 text-center">
            <p className="font-semibold text-text">Nog geen productafbeeldingen</p>
            <p className="mt-1 text-body-sm text-muted">Upload een foto of genereer een nieuwe afbeelding om te beginnen.</p>
          </div>
        ) : null}
        {images.map((image, index) => (
          <article
            key={image.id}
            draggable={!busy}
            onDragStart={() => { dragId.current = image.id; }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(image.id)}
            className={`rounded-card border p-3 ${selected?.id === image.id ? "border-accent ring-2 ring-accent/20" : "border-border"}`}
          >
            <button type="button" onClick={() => setSelectedImageId(image.id)} className="block min-h-11 w-full text-left" aria-label={`Afbeelding ${index + 1} als bron selecteren`} aria-pressed={selected?.id === image.id}>
              <div className="relative">
                <img src={image.url} alt={image.alt || productName} loading="lazy" decoding="async" className="aspect-square w-full rounded-button bg-background object-contain" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-xs font-bold text-text shadow"><GripVertical className="h-3.5 w-3.5" />{index + 1}</span>
                {image.isPrimary ? <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-bold text-contrast"><Star className="h-3.5 w-3.5 fill-current" />Primair</span> : null}
              </div>
            </button>
            <label className="mt-3 block text-body-sm font-semibold text-text">Alt-tekst
              <input value={image.alt ?? ""} onChange={(event) => setImages(images.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item))} className={inputClass} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => move(image.id, -1)} disabled={busy || index === 0} className={buttonClass}><ArrowUp className="h-4 w-4" />Omhoog</button>
              <button type="button" onClick={() => move(image.id, 1)} disabled={busy || index === images.length - 1} className={buttonClass}><ArrowDown className="h-4 w-4" />Omlaag</button>
              <button type="button" onClick={() => void persistOrder(images, image.id)} disabled={busy || image.isPrimary} className={buttonClass}><Star className="h-4 w-4" />Primair</button>
              <button type="button" onClick={() => void saveAlt(image)} disabled={busy} className={buttonClass}><Save className="h-4 w-4" />Alt opslaan</button>
              <button type="button" onClick={() => void remove(image)} disabled={busy || images.length === 1} className={`${buttonClass} col-span-2 border-red-200 text-red-700`}><Trash2 className="h-4 w-4" />Naar prullenbak</button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-card border border-border bg-background p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /><h3 className="text-heading-sm text-text">Nieuwe versie maken</h3></div>
        <p className="mt-1 text-body-sm text-muted">AI-bewerkingen gebruiken GPT Image 2. Bijsnijden, schalen, achtergrond verwijderen, labels en iconen zijn deterministisch.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-body-sm font-semibold text-text">Bewerking
            <select value={operation} onChange={(event) => setOperation(event.target.value as StudioOperation)} className={inputClass}>{operations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          {needsSource ? <label className="text-body-sm font-semibold text-text">Bronafbeelding
            <select value={selected?.id ?? ""} onChange={(event) => setSelectedImageId(event.target.value)} className={inputClass}>{images.map((image, index) => <option key={image.id} value={image.id}>Foto {index + 1}{image.isPrimary ? " (primair)" : ""}</option>)}</select>
          </label> : null}
          {usesDimensions ? <><label className="text-body-sm font-semibold text-text">Breedte (px)<input type="number" min="16" max="3840" value={width} onChange={(event) => setWidth(Number(event.target.value))} className={inputClass} /></label><label className="text-body-sm font-semibold text-text">Hoogte (px)<input type="number" min="16" max="3840" value={height} onChange={(event) => setHeight(Number(event.target.value))} className={inputClass} /></label></> : null}
          {usesCoordinates ? <><label className="text-body-sm font-semibold text-text">X-positie<input type="number" min="0" max="3840" value={x} onChange={(event) => setX(Number(event.target.value))} className={inputClass} /></label><label className="text-body-sm font-semibold text-text">Y-positie<input type="number" min="0" max="3840" value={y} onChange={(event) => setY(Number(event.target.value))} className={inputClass} /></label></> : null}
          {operationInfo.ai ? <label className="text-body-sm font-semibold text-text">Kwaliteit<select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)} className={inputClass}><option value="low">Concept</option><option value="medium">Normaal</option><option value="high">Hoog</option></select></label> : null}
          {operation === "text_label" ? <label className="text-body-sm font-semibold text-text">Tekst<input value={text} maxLength={80} onChange={(event) => setText(event.target.value)} className={inputClass} /></label> : null}
          {operation === "text_label" || operation === "icon" ? <label className="text-body-sm font-semibold text-text">Kleur<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className={`${inputClass} p-1`} /></label> : null}
        </div>
        {needsPrompt ? <label className="mt-4 block text-body-sm font-semibold text-text">Opdracht<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} rows={4} placeholder="Beschrijf alleen wat moet veranderen en wat exact gelijk moet blijven." className={`${inputClass} py-3`} /></label> : null}
        <button type="button" onClick={() => void runStudio()} disabled={busy || (needsSource && !selected)} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-5 font-bold text-contrast disabled:opacity-50"><Sparkles className="h-4 w-4" />{busy ? "Bezig…" : "Nieuwe versie maken"}</button>
      </div>
    </section>
  );
}
