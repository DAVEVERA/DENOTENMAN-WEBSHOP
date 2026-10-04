"use client";

/* eslint-disable @next/next/no-img-element -- Canva thumbnails are short-lived links on Canva's CDN. */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";

import { CANVA_DESIGN_SIZES, type CanvaDesignSizeId } from "@/lib/canva/config";

type CanvaStatus = { configured: boolean; connected: boolean; displayName: string | null; canManage: boolean };
type CanvaDesign = { id: string; title: string; thumbnailUrl: string | null; editUrl: string | null; pageCount: number | null; updatedAt: number | null };
export type CanvaImportedImage = { id: string; url: string; width: number | null; height: number | null; page: number };

export const CANVA_CHANNEL = "denotenman-canva";
export type CanvaChannelMessage = { type: "imported"; pickerId: string | null; images: CanvaImportedImage[] };

const smallButton = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold text-text disabled:opacity-40";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast disabled:opacity-50";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "Canva gaf een fout.");
  return body;
}

function base64UrlJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Canva's edit link with our return state, so "Return to De Notenman" lands on the right field. */
function editLink(editUrl: string, pickerId: string): string {
  const url = new URL(editUrl);
  url.searchParams.set("correlation_state", base64UrlJson({ r: `${window.location.pathname}${window.location.search}`, p: pickerId }));
  return url.toString();
}

function CanvaMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <circle cx="12" cy="12" r="12" fill="#7d2ae8" />
      <path d="M15.6 15.3c-.8 1-1.9 1.7-3.2 1.7-2.2 0-3.6-2-3.3-4.4.4-3 2.6-5.3 4.8-5.3 1.1 0 1.8.6 1.8 1.5 0 .9-.6 1.4-1.1 1.4-.3 0-.4-.2-.4-.4 0-.3.3-.5.3-.9 0-.4-.3-.7-.8-.7-1.4 0-2.9 2-3.1 4.2-.2 1.6.6 2.9 2 2.9 1.1 0 2-.6 2.6-1.4.1-.2.4-.2.5 0 .1.1 0 .3-.1.4Z" fill="#fff" />
    </svg>
  );
}

/**
 * Opens Canva from anywhere in the admin: pick an existing design, start a new one in
 * a preset size, or send the current image to Canva. The chosen design is exported
 * into the media library and handed back through onSelect.
 */
export function CanvaPicker({
  onSelect,
  sourceImageUrl,
  defaultSize = "newsletter-image",
  designTitle = "De Notenman",
  label = "Canva",
  className = smallButton,
}: {
  onSelect: (url: string, images: CanvaImportedImage[]) => void;
  sourceImageUrl?: string;
  defaultSize?: CanvaDesignSizeId;
  designTitle?: string;
  label?: string;
  className?: string;
}) {
  const pickerId = `p${useId().replace(/[^\w-]/gu, "")}`;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [tab, setTab] = useState<"designs" | "new">("designs");
  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [size, setSize] = useState<CanvaDesignSizeId>(defaultSize);
  const [title, setTitle] = useState(designTitle);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CanvaDesign | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const deliver = useCallback((images: CanvaImportedImage[]) => {
    if (!images.length) return;
    onSelectRef.current(images[0].url, images);
    setPending(null);
    setOpen(false);
  }, []);

  // The return page in the Canva tab reports the import back to the field that asked.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CANVA_CHANNEL);
    channel.onmessage = (event: MessageEvent<CanvaChannelMessage>) => {
      if (event.data?.type === "imported" && event.data.pickerId === pickerId) deliver(event.data.images);
    };
    return () => channel.close();
  }, [pickerId, deliver]);

  const loadDesigns = useCallback(async (options: { more?: boolean; search?: string } = {}) => {
    setBusy("list");
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.search) params.set("query", options.search);
      if (options.more && continuation) params.set("continuation", continuation);
      const body = await api<{ designs: CanvaDesign[]; continuation: string | null }>(`/api/admin/canva/designs?${params}`);
      setDesigns((current) => options.more ? [...current, ...body.designs] : body.designs);
      setContinuation(body.continuation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Designs laden mislukt.");
    } finally {
      setBusy(null);
    }
  }, [continuation]);

  async function openDialog() {
    setOpen(true);
    setError(null);
    try {
      const next = await api<CanvaStatus>("/api/admin/canva/status");
      setStatus(next);
      if (next.connected) void loadDesigns();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Canva-status ophalen mislukt.");
    }
  }

  async function importDesign(design: CanvaDesign) {
    setBusy(`import-${design.id}`);
    setError(null);
    try {
      const body = await api<{ images: CanvaImportedImage[] }>(`/api/admin/canva/designs/${encodeURIComponent(design.id)}/import`, {
        method: "POST",
        body: JSON.stringify({ format, ...(design.pageCount && design.pageCount > 1 ? { pages: [1] } : {}) }),
      });
      deliver(body.images);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Importeren mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function createDesign(fromImage: boolean) {
    const preset = CANVA_DESIGN_SIZES.find((item) => item.id === size) ?? CANVA_DESIGN_SIZES[0];
    // Open the tab synchronously so pop-up blockers allow it; point it at Canva once ready.
    const tabWindow = window.open("about:blank", "_blank");
    setBusy(fromImage ? "from-image" : "create");
    setError(null);
    try {
      const body = await api<{ design: CanvaDesign }>("/api/admin/canva/designs", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || designTitle,
          ...(fromImage && sourceImageUrl ? { imageUrl: sourceImageUrl } : { width: preset.width, height: preset.height }),
          returnTo: `${window.location.pathname}${window.location.search}`,
          pickerId,
        }),
      });
      if (!body.design.editUrl) throw new Error("Canva gaf geen bewerklink terug.");
      if (tabWindow) tabWindow.location.href = body.design.editUrl;
      else window.open(body.design.editUrl, "_blank", "noopener");
      setPending(body.design);
    } catch (cause) {
      tabWindow?.close();
      setError(cause instanceof Error ? cause.message : "Design maken mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Canva ontkoppelen voor het hele portaal?")) return;
    setBusy("disconnect");
    try {
      await api("/api/admin/canva/disconnect", { method: "POST" });
      setStatus((current) => current ? { ...current, connected: false, displayName: null } : current);
      setDesigns([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ontkoppelen mislukt.");
    } finally {
      setBusy(null);
    }
  }

  const connectHref = typeof window === "undefined" ? "#" : `/api/admin/canva/connect?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;

  return (
    <>
      <button type="button" onClick={() => void openDialog()} className={className}>
        <CanvaMark />{label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Canva">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-panel bg-surface shadow-card sm:rounded-panel">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <CanvaMark />
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-heading-sm font-bold text-text">Canva</h2>
                {status?.connected ? <p className="truncate text-xs text-muted">Gekoppeld{status.displayName ? ` als ${status.displayName}` : ""}</p> : null}
              </div>
              {status?.connected && status.canManage ? <button type="button" onClick={() => void disconnect()} disabled={busy !== null} className="text-xs font-semibold text-muted underline underline-offset-4">Ontkoppelen</button> : null}
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border" aria-label="Sluiten"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {error ? <p role="alert" className="mb-3 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-800">{error}</p> : null}
              {!status && !error ? <p className="flex items-center gap-2 text-body-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Canva-status ophalen…</p> : null}

              {status && !status.configured ? (
                <div className="grid gap-2 text-body-sm text-text">
                  <p className="font-semibold">Canva is nog niet ingesteld op de server.</p>
                  <p className="text-muted">Maak een Connect-integratie aan in het Canva Developer Portal en zet <code>CANVA_CLIENT_ID</code> en <code>CANVA_CLIENT_SECRET</code> in de omgeving. Zie Instellingen → Integraties.</p>
                </div>
              ) : null}

              {status?.configured && !status.connected ? (
                <div className="grid justify-items-start gap-3 text-body-sm">
                  <p>Koppel het Canva-account van De Notenman om designs te maken en te gebruiken in nieuwsbrieven, productfoto&apos;s en social posts.</p>
                  {status.canManage ? <a href={connectHref} className={primaryButton}><CanvaMark />Canva koppelen</a> : <p className="text-muted">Vraag een owner of admin om Canva te koppelen.</p>}
                </div>
              ) : null}

              {status?.connected ? (
                <div className="grid gap-4">
                  {pending ? (
                    <div className="grid gap-2 rounded-card border border-accent/60 bg-accent/10 p-3 text-body-sm">
                      <p className="font-semibold">“{pending.title}” staat open in Canva.</p>
                      <p className="text-muted">Klaar met ontwerpen? Klik in Canva op terug naar De Notenman, of importeer het hier.</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void importDesign(pending)} disabled={busy !== null} className={primaryButton}>{busy === `import-${pending.id}` ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}Nu importeren</button>
                        {pending.editUrl ? <a href={editLink(pending.editUrl, pickerId)} target="_blank" rel="noopener noreferrer" className={smallButton}><ExternalLink className="h-4 w-4" aria-hidden="true" />Opnieuw openen</a> : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Canva">
                    {([["designs", "Mijn designs"], ["new", "Nieuw design"]] as const).map(([value, text]) => (
                      <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`${smallButton} ${tab === value ? "border-accent-ink bg-accent/15" : ""}`}>{text}</button>
                    ))}
                    <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-text">Formaat
                      <select value={format} onChange={(event) => setFormat(event.target.value as "png" | "jpg")} className="min-h-11 rounded-button border border-border bg-background px-2 text-body-sm">
                        <option value="png">PNG (scherp, transparant)</option>
                        <option value="jpg">JPG (kleiner bestand)</option>
                      </select>
                    </label>
                  </div>

                  {tab === "designs" ? (
                    <div className="grid gap-3">
                      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadDesigns({ search: query }); }}>
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek in je Canva-designs" aria-label="Zoek in Canva" className="min-h-11 w-full min-w-0 rounded-button border border-border bg-background px-3 text-base" />
                        <button type="submit" disabled={busy !== null} className={smallButton} aria-label="Zoeken"><Search className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => void loadDesigns({ search: query })} disabled={busy !== null} className={smallButton} aria-label="Vernieuwen"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
                      </form>
                      {busy === "list" && !designs.length ? <p className="text-body-sm text-muted">Designs laden…</p> : null}
                      {!designs.length && busy !== "list" ? <p className="text-body-sm text-muted">Geen designs gevonden.</p> : null}
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {designs.map((design) => (
                          <li key={design.id} className="grid content-start gap-2 rounded-card border border-border bg-background p-2">
                            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-button bg-surface">
                              {design.thumbnailUrl ? <img src={design.thumbnailUrl} alt="" className="h-full w-full object-contain" loading="lazy" /> : <CanvaMark />}
                            </div>
                            <p className="truncate text-body-sm font-semibold text-text" title={design.title}>{design.title}</p>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => void importDesign(design)} disabled={busy !== null} className={`${smallButton} flex-1`}>
                                {busy === `import-${design.id}` ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}Gebruiken
                              </button>
                              {design.editUrl ? <a href={editLink(design.editUrl, pickerId)} target="_blank" rel="noopener noreferrer" onClick={() => setPending(design)} className={smallButton} aria-label={`${design.title} bewerken in Canva`}><ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {continuation ? <button type="button" onClick={() => void loadDesigns({ more: true, search: query })} disabled={busy !== null} className={`${smallButton} justify-self-center`}>Meer laden</button> : null}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-body-sm font-semibold text-text">Naam van het design
                        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="min-h-11 rounded-button border border-border bg-background px-3 text-base" />
                      </label>
                      {sourceImageUrl ? (
                        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-background p-3">
                          <img src={sourceImageUrl} alt="" className="h-16 w-16 rounded-button border border-border object-cover" />
                          <p className="min-w-0 flex-1 text-body-sm">Bewerk de huidige afbeelding in Canva, in dezelfde verhouding.</p>
                          <button type="button" onClick={() => void createDesign(true)} disabled={busy !== null} className={primaryButton}>{busy === "from-image" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CanvaMark />}Bewerken in Canva</button>
                        </div>
                      ) : null}
                      <fieldset className="grid gap-2">
                        <legend className="mb-1 text-body-sm font-semibold text-text">Of begin leeg in een formaat</legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {CANVA_DESIGN_SIZES.map((preset) => (
                            <label key={preset.id} className={`flex min-h-11 items-center gap-2 rounded-button border px-3 py-2 text-body-sm ${size === preset.id ? "border-accent-ink bg-accent/10" : "border-border bg-background"}`}>
                              <input type="radio" name={`${pickerId}-size`} checked={size === preset.id} onChange={() => setSize(preset.id)} />
                              <span className="min-w-0 flex-1">{preset.label}</span>
                              <span className="text-xs text-muted">{preset.width}×{preset.height}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <button type="button" onClick={() => void createDesign(false)} disabled={busy !== null} className={`${primaryButton} justify-self-start`}>{busy === "create" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}Openen in Canva</button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
