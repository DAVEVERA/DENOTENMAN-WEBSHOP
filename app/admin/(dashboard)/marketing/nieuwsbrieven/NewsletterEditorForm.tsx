"use client";

/* eslint-disable @next/next/no-img-element -- product and media thumbnails come from the public bucket. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Camera,
  ChevronDown,
  Copy,
  GripVertical,
  Grid3x3,
  Film,
  Grid2x2,
  Heading,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  LoaderCircle,
  Minus,
  MousePointerClick,
  Monitor,
  Package,
  Plus,
  Quote,
  Share2,
  Smartphone,
  Smile,
  SquareCode,
  Table,
  Trash2,
  Type,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import { MediaPickerButton } from "@/components/admin-panel/MediaPickerButton";
import { uploadMediaInChunks } from "@/components/admin-panel/media/chunked-upload";
import { extractNewsletterContent } from "@/lib/mailchimp/template";
import {
  createNewsletterBlock,
  newBlockId,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterDocument,
  type NewsletterTheme,
} from "@/lib/newsletter/document";
import { renderNewsletterEmail } from "@/lib/newsletter/render";
import {
  VIDEO_THUMBNAIL_ASPECT_LABELS,
  VIDEO_THUMBNAIL_ASPECTS,
  type VideoThumbnailAspect,
  youtubeId,
} from "@/lib/newsletter/video";
import { VideoFramePicker } from "./VideoFramePicker";
import { BlockStyleFields, BrandLogoButtons, FontSelect, LayoutFields, ThemePresetBar } from "./NewsletterStyleControls";
import type { NewsletterAudience } from "@/lib/mailchimp/schemas";
import { targetingProblem, type NewsletterTargeting } from "@/lib/mailchimp/targeting";
import { AudienceSegmentPicker } from "./AudienceSegmentPicker";

type NewsletterDraft = {
  subject: string;
  previewText: string;
  title: string;
  fromName: string;
  replyTo: string;
  contentHtml: string;
  audience: NewsletterAudience;
  targeting?: NewsletterTargeting;
};

const AUDIENCE_OPTIONS: Array<{ value: NewsletterAudience; label: string }> = [
  { value: "all", label: "Iedereen" },
  { value: "zakelijk", label: "Zakelijk" },
  { value: "particulier", label: "Particulier" },
  { value: "segment", label: "Segment of tags" },
];

const BLOCK_TYPES: Array<{ type: NewsletterBlockType; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "heading", label: "Kop", hint: "Titel of tussenkop", icon: Heading },
  { type: "text", label: "Tekst", hint: "Alinea's, lijsten, links", icon: Type },
  { type: "image", label: "Afbeelding of GIF", hint: "Met link en onderschrift", icon: ImageIcon },
  { type: "video", label: "Video", hint: "Miniatuur met afspeelknop", icon: Film },
  { type: "button", label: "Knop", hint: "Duidelijke oproep", icon: MousePointerClick },
  { type: "products", label: "Producten", hint: "Uit de webshop", icon: Package },
  { type: "columns", label: "Kolommen", hint: "2 of 3 naast elkaar", icon: Grid2x2 },
  { type: "icons", label: "Iconen", hint: "Emoji met korte tekst", icon: Smile },
  { type: "table", label: "Tabel", hint: "Prijzen of schema", icon: Table },
  { type: "quote", label: "Citaat", hint: "Review of uitspraak", icon: Quote },
  { type: "social", label: "Social links", hint: "Facebook, Instagram, …", icon: Share2 },
  { type: "divider", label: "Scheidingslijn", hint: "Rustpunt", icon: Minus },
  { type: "spacer", label: "Witruimte", hint: "Extra ruimte", icon: ChevronDown },
  { type: "html", label: "Eigen HTML", hint: "Voor gevorderden", icon: SquareCode },
];

const blockLabel = (type: NewsletterBlockType) => BLOCK_TYPES.find((item) => item.type === type)?.label ?? type;

const inputClass = "min-h-11 w-full min-w-0 rounded-button border border-border bg-background px-3 py-2 text-base text-text";
const labelClass = "grid gap-1 text-body-sm font-semibold text-text";
const smallButton = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold text-text disabled:opacity-40";
const iconButton = "inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface text-text disabled:opacity-30";

type ApiError = { error?: string; message?: string; fieldErrors?: Array<{ field: string; message: string }>; issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };

function recipientCountForAudience(audience: NewsletterAudience, total: number, business: number): number {
  if (audience === "zakelijk") return business;
  if (audience === "particulier") return Math.max(0, total - business);
  return total;
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  if (body?.fieldErrors?.[0]?.message) return body.fieldErrors[0].message;
  if (body?.message) return body.message;
  const issue = body?.issues?.formErrors?.[0] ?? Object.values(body?.issues?.fieldErrors ?? {})[0]?.[0];
  if (issue) return `Controleer de inhoud: ${issue}`;
  if (body?.error === "CONFIRMATION_REQUIRED") return "Bevestig deze onomkeerbare actie.";
  return "De actie is niet uitgevoerd. Probeer opnieuw.";
}

// ---------- Small fields ----------

function ColorField({ label, value, onChange, nullable }: { label: string; value: string | null; onChange: (value: string | null) => void; nullable?: boolean }) {
  return (
    <label className={labelClass}>
      {label}
      <span className="flex items-center gap-2">
        <input type="color" value={value ?? "#000000"} onChange={(event) => onChange(event.target.value)} className="h-11 w-14 shrink-0 rounded-button border border-border bg-background" aria-label={`${label} kiezen`} />
        <input value={value ?? ""} onChange={(event) => onChange(/^#[0-9a-fA-F]{6}$/u.test(event.target.value) ? event.target.value : value)} placeholder={nullable ? "Standaard" : "#000000"} className={`${inputClass} font-mono`} aria-label={`${label} als hexcode`} />
        {nullable && value ? <button type="button" onClick={() => onChange(null)} className={smallButton}>Standaard</button> : null}
      </span>
    </label>
  );
}

function AlignField({ value, onChange }: { value: "left" | "center" | "right"; onChange: (value: "left" | "center" | "right") => void }) {
  return (
    <fieldset className="grid min-w-0 gap-1">
      <legend className="text-body-sm font-semibold text-text">Uitlijning</legend>
      <div className="flex gap-1">
        {([["left", "Links"], ["center", "Midden"], ["right", "Rechts"]] as const).map(([option, text]) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`${smallButton} min-h-11 flex-1 ${value === option ? "border-accent-ink bg-accent/15" : ""}`}>{text}</button>
        ))}
      </div>
    </fieldset>
  );
}

function RichTextField({ label, value, onChange, rows = 6 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function wrap(before: string, after = before, placeholder = "tekst") {
    const area = ref.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => area?.focus());
  }
  function link() {
    const url = window.prompt("Link (https://…)", "https://denotenman.com");
    if (url) wrap("[", `](${url})`, "linktekst");
  }
  function list() {
    const area = ref.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "Punt";
    const bulleted = selected.split("\n").map((line) => `- ${line.replace(/^[-*]\s+/u, "")}`).join("\n");
    onChange(`${value.slice(0, start)}${start > 0 && !value.slice(0, start).endsWith("\n\n") ? "\n\n" : ""}${bulleted}\n\n${value.slice(end)}`);
  }
  return (
    <div className="grid gap-1">
      <span className="text-body-sm font-semibold text-text">{label}</span>
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label={`Opmaak ${label}`}>
        <button type="button" onClick={() => wrap("**")} className={smallButton} aria-label="Vet"><Bold className="h-3.5 w-3.5" aria-hidden="true" />Vet</button>
        <button type="button" onClick={() => wrap("*")} className={smallButton} aria-label="Cursief"><Italic className="h-3.5 w-3.5" aria-hidden="true" />Cursief</button>
        <button type="button" onClick={link} className={smallButton}><Link2 className="h-3.5 w-3.5" aria-hidden="true" />Link</button>
        <button type="button" onClick={list} className={smallButton}><List className="h-3.5 w-3.5" aria-hidden="true" />Lijst</button>
        <button type="button" onClick={() => wrap("*|FNAME|*", "", "")} className={smallButton}><UserRound className="h-3.5 w-3.5" aria-hidden="true" />Voornaam</button>
      </div>
      <textarea ref={ref} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} leading-6`} aria-label={label} />
      <span className="text-xs text-muted">Lege regel = nieuwe alinea. Regels die met &quot;- &quot; beginnen worden een lijst.</span>
    </div>
  );
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const media = await uploadMediaInChunks(file, setProgress);
      onChange(media.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Uploaden mislukt.");
    } finally {
      setProgress(null);
    }
  }
  return (
    <div className="grid gap-1">
      <span className="text-body-sm font-semibold text-text">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {value ? <img src={value} alt="" className="h-14 w-14 rounded-card border border-border object-cover" /> : null}
        <MediaPickerButton onSelect={onChange} label="Mediabibliotheek" className={smallButton} />
        <button type="button" onClick={() => input.current?.click()} disabled={progress !== null} className={smallButton}>{progress !== null ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}{progress !== null ? `${progress}%` : "Uploaden (ook GIF)"}</button>
        {value ? <button type="button" onClick={() => onChange("")} className={smallButton}>Verwijderen</button> : null}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
      </div>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="of plak een https-link" className={inputClass} aria-label={`${label} link`} />
      {error ? <span role="alert" className="text-xs font-semibold text-red-700">{error}</span> : null}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className={labelClass}>
      <span className="flex justify-between">{label}<span className="text-muted">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-h-11 w-full accent-[color:var(--color-accent-ink,#6b5b00)]" />
    </label>
  );
}

// ---------- Block editors ----------

function ProductPicker({ block, onChange }: { block: Extract<NewsletterBlock, { type: "products" }>; onChange: (block: NewsletterBlock) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Extract<NewsletterBlock, { type: "products" }>["items"][number]>>([]);
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/newsletter/products?q=${encodeURIComponent(query)}`);
      const body = await response.json().catch(() => ({ products: [] })) as { products?: typeof results };
      setResults(body.products ?? []);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>Kolommen<select value={block.columns} onChange={(event) => onChange({ ...block, columns: Number(event.target.value) as 2 | 3 })} className={inputClass}><option value={2}>2 naast elkaar</option><option value={3}>3 naast elkaar</option></select></label>
        <label className={labelClass}>Knoptekst<input value={block.buttonText} onChange={(event) => onChange({ ...block, buttonText: event.target.value })} maxLength={40} className={inputClass} /></label>
      </div>
      {block.items.length ? (
        <ul className="grid gap-2">
          {block.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex items-center gap-2 rounded-card border border-border bg-background p-2">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" /> : null}
              <span className="min-w-0 flex-1 text-body-sm"><span className="block truncate font-semibold">{item.name}</span><span className="text-xs text-muted">{item.priceLabel}</span></span>
              <button type="button" disabled={index === 0} onClick={() => { const items = [...block.items]; [items[index - 1], items[index]] = [items[index], items[index - 1]]; onChange({ ...block, items }); }} className={iconButton} aria-label="Omhoog"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" onClick={() => onChange({ ...block, items: block.items.filter((_, position) => position !== index) })} className={iconButton} aria-label={`${item.name} weghalen`}><X className="h-4 w-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-body-sm text-muted">Nog geen producten gekozen.</p>}
      <div className="flex gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder="Zoek een product, bv. cashew" className={inputClass} aria-label="Product zoeken" />
        <button type="button" onClick={() => void search()} disabled={busy} className={`${smallButton} min-h-11`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : "Zoeken"}</button>
      </div>
      {results.length ? (
        <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-card border border-border p-1">
          {results.map((result) => {
            const chosen = block.items.some((item) => item.productId === result.productId);
            return (
              <li key={result.productId}>
                <button type="button" disabled={chosen || block.items.length >= 9} onClick={() => onChange({ ...block, items: [...block.items, result] })} className="flex w-full items-center gap-2 rounded-button p-2 text-left text-body-sm hover:bg-background disabled:opacity-50">
                  {result.imageUrl ? <img src={result.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : null}
                  <span className="min-w-0 flex-1 truncate">{result.name}</span>
                  <span className="text-xs text-muted">{result.priceLabel}</span>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function VideoEditor({ block, onChange }: { block: Extract<NewsletterBlock, { type: "video" }>; onChange: (block: NewsletterBlock) => void }) {
  // Uploads finish after the block may have changed; always build on the newest version.
  const latest = useRef(block);
  useEffect(() => {
    latest.current = block;
  }, [block]);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"thumbnail" | "upload" | "frame" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameSource, setFrameSource] = useState<File | string | null>(null);
  const isYoutube = Boolean(youtubeId(block.videoUrl));

  function patch(changes: Partial<Extract<NewsletterBlock, { type: "video" }>>) {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    onChange(next);
  }

  async function makeThumbnail(options: { posterUrl?: string; aspect?: VideoThumbnailAspect } = {}) {
    const current = latest.current;
    const posterUrl = options.posterUrl ?? current.posterUrl;
    const aspect = options.aspect ?? current.aspect;
    if (!current.videoUrl) {
      setError("Vul eerst een videolink in of upload een video.");
      return;
    }
    if (!posterUrl && !youtubeId(current.videoUrl)) {
      setError("Kies eerst een stilstaand beeld: uit de video of als foto.");
      return;
    }
    setBusy("thumbnail");
    setError(null);
    try {
      const response = await fetch("/api/admin/newsletter/video-thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoUrl: current.videoUrl, aspect, ...(posterUrl ? { imageUrl: posterUrl } : {}) }),
      });
      const body = await response.json().catch(() => ({})) as { thumbnailUrl?: string; message?: string };
      if (!response.ok || !body.thumbnailUrl) throw new Error(body.message || "Miniatuur maken mislukt.");
      patch({ thumbnailUrl: body.thumbnailUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Miniatuur maken mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(file: File) {
    setError(null);
    setFrameSource(file);
    setBusy("upload");
    setProgress(0);
    try {
      const media = await uploadMediaInChunks(file, setProgress);
      if (media.kind !== "video") throw new Error("Kies een MP4-, MOV- of WebM-video.");
      patch({ videoUrl: media.url, posterUrl: "", thumbnailUrl: "" });
    } catch (cause) {
      setFrameSource(null);
      setError(cause instanceof Error ? cause.message : "Uploaden mislukt.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function captureFrame(frame: File) {
    setBusy("frame");
    setError(null);
    try {
      const media = await uploadMediaInChunks(frame, () => undefined);
      patch({ posterUrl: media.url });
      setFrameSource(null);
      await makeThumbnail({ posterUrl: media.url });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Beeld opslaan mislukt.");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">E-mailprogramma&apos;s spelen geen video af. Je lezer ziet een beeld met een afspeelknop dat naar de video linkt.</p>
      <label className={labelClass}>Videolink (YouTube, TikTok, Vimeo of je eigen video)<input value={block.videoUrl} onChange={(event) => patch({ videoUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=…" className={inputClass} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => videoInput.current?.click()} disabled={busy !== null} className={`${smallButton} min-h-11`}>
          {busy === "upload" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {busy === "upload" && progress !== null ? `Video uploaden ${progress}%` : "Video uploaden"}
        </button>
        {block.videoUrl && !isYoutube && !frameSource ? (
          <button type="button" onClick={() => setFrameSource(block.videoUrl)} disabled={busy !== null} className={`${smallButton} min-h-11`}><Camera className="h-4 w-4" aria-hidden="true" />Beeld uit video kiezen</button>
        ) : null}
        <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVideo(file); event.target.value = ""; }} />
      </div>
      {frameSource ? <VideoFramePicker source={frameSource} onCapture={captureFrame} onClose={() => setFrameSource(null)} /> : null}
      <ImageField label={isYoutube ? "Eigen stilstaand beeld (optioneel, anders de YouTube-miniatuur)" : "Of kies een foto als stilstaand beeld"} value={block.posterUrl} onChange={(posterUrl) => patch({ posterUrl })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Vorm van de miniatuur
          <select value={block.aspect} onChange={(event) => { const aspect = event.target.value as VideoThumbnailAspect; patch({ aspect }); if (block.thumbnailUrl) void makeThumbnail({ aspect }); }} className={inputClass}>
            {VIDEO_THUMBNAIL_ASPECTS.map((option) => <option key={option} value={option}>{VIDEO_THUMBNAIL_ASPECT_LABELS[option]}</option>)}
          </select>
        </label>
        <Slider label="Breedte" value={block.width} min={20} max={100} step={5} suffix="%" onChange={(width) => patch({ width })} />
      </div>
      <AlignField value={block.align} onChange={(align) => patch({ align })} />
      <button type="button" onClick={() => void makeThumbnail()} disabled={busy !== null || !block.videoUrl} className={`${smallButton} min-h-11 justify-self-start`}>{busy === "thumbnail" || busy === "frame" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Film className="h-4 w-4" aria-hidden="true" />}{block.thumbnailUrl ? "Miniatuur opnieuw maken" : "Miniatuur met afspeelknop maken"}</button>
      {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
      {block.thumbnailUrl ? <img src={block.thumbnailUrl} alt="" className="w-full max-w-xs rounded-card border border-border" /> : null}
      <label className={labelClass}>Titel onder de video<input value={block.title} onChange={(event) => patch({ title: event.target.value })} maxLength={200} className={inputClass} /></label>
      <label className={labelClass}>Onderschrift<input value={block.caption} onChange={(event) => patch({ caption: event.target.value })} maxLength={300} className={inputClass} /></label>
    </div>
  );
}

function BlockFields({ block, onChange, grid }: { block: NewsletterBlock; onChange: (block: NewsletterBlock) => void; grid: number }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3">
          <label className={labelClass}>Tekst<input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} maxLength={200} className={inputClass} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Grootte<select value={block.level} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 1 | 2 | 3 })} className={inputClass}><option value={1}>Groot</option><option value={2}>Middel</option><option value={3}>Klein</option></select></label>
            <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
          </div>
          <ColorField label="Kleur" value={block.color} nullable onChange={(color) => onChange({ ...block, color })} />
        </div>
      );
    case "text":
      return (
        <div className="grid gap-3">
          <RichTextField label="Tekst" value={block.text} onChange={(text) => onChange({ ...block, text })} rows={8} />
          <div className="grid gap-3 sm:grid-cols-2">
            <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
            <Slider label="Lettergrootte" value={block.fontSize} min={13} max={22} suffix="px" onChange={(fontSize) => onChange({ ...block, fontSize })} />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3">
          <ImageField label="Afbeelding of GIF" value={block.url} onChange={(url) => onChange({ ...block, url })} />
          <label className={labelClass}>Omschrijving voor schermlezers (alt-tekst)<input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} maxLength={300} className={inputClass} /></label>
          <label className={labelClass}>Link bij klikken (optioneel)<input value={block.linkUrl} onChange={(event) => onChange({ ...block, linkUrl: event.target.value })} placeholder="https://…" className={inputClass} /></label>
          <label className={labelClass}>Onderschrift (optioneel)<input value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} maxLength={300} className={inputClass} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Slider label="Breedte" value={block.width} min={20} max={100} step={5} suffix="%" onChange={(width) => onChange({ ...block, width })} />
            <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="checkbox" checked={block.rounded} onChange={(event) => onChange({ ...block, rounded: event.target.checked })} />Afgeronde hoeken</label>
          <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="checkbox" checked={block.fullBleed} onChange={(event) => onChange({ ...block, fullBleed: event.target.checked })} />Van rand tot rand (banner)</label>
        </div>
      );
    case "video":
      return <VideoEditor block={block} onChange={onChange} />;
    case "button":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Knoptekst<input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} maxLength={80} className={inputClass} /></label>
            <label className={labelClass}>Link<input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="https://…" className={inputClass} /></label>
          </div>
          <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Knopkleur" value={block.background} nullable onChange={(background) => onChange({ ...block, background })} />
            <ColorField label="Tekstkleur" value={block.color} nullable onChange={(color) => onChange({ ...block, color })} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="checkbox" checked={block.fullWidth} onChange={(event) => onChange({ ...block, fullWidth: event.target.checked })} />Volle breedte</label>
        </div>
      );
    case "products":
      return <ProductPicker block={block} onChange={onChange} />;
    case "columns":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>Aantal kolommen<select value={block.count} onChange={(event) => onChange({ ...block, count: Number(event.target.value) as 2 | 3 })} className={inputClass}><option value={2}>2</option><option value={3}>3</option></select></label>
            <label className={labelClass}>Verhouding<select value={block.count === 2 ? block.ratio : "equal"} disabled={block.count !== 2} onChange={(event) => onChange({ ...block, ratio: event.target.value as typeof block.ratio })} className={inputClass}><option value="equal">Even breed</option><option value="wide-left">Links breder (2:1)</option><option value="wide-right">Rechts breder (1:2)</option></select></label>
            <Slider label="Tussenruimte" value={block.gap} min={0} max={48} step={grid} suffix="px" onChange={(gap) => onChange({ ...block, gap })} />
          </div>
          {block.items.map((item, index) => (
            <fieldset key={index} className="grid min-w-0 gap-2 rounded-card border border-border bg-background p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Kolom {index + 1}</legend>
              <ImageField label="Afbeelding" value={item.imageUrl} onChange={(imageUrl) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, imageUrl } : other) })} />
              <label className={labelClass}>Titel<input value={item.heading} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, heading: event.target.value } : other) })} maxLength={120} className={inputClass} /></label>
              <RichTextField label="Tekst" value={item.text} rows={3} onChange={(text) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, text } : other) })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={labelClass}>Linktekst<input value={item.buttonText} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, buttonText: event.target.value } : other) })} maxLength={60} className={inputClass} /></label>
                <label className={labelClass}>Link<input value={item.buttonUrl} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, buttonUrl: event.target.value } : other) })} className={inputClass} /></label>
              </div>
              {block.items.length > 2 ? <button type="button" onClick={() => onChange({ ...block, items: block.items.filter((_, position) => position !== index) })} className={`${smallButton} justify-self-start`}>Kolom verwijderen</button> : null}
            </fieldset>
          ))}
          {block.items.length < 6 ? <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { imageUrl: "", heading: "", text: "", buttonText: "", buttonUrl: "" }] })} className={`${smallButton} justify-self-start`}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Kolom toevoegen</button> : null}
        </div>
      );
    case "icons":
      return (
        <div className="grid gap-3">
          {block.items.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-card border border-border bg-background p-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
              <label className={labelClass}>Icoon<input value={item.icon} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, icon: event.target.value } : other) })} maxLength={8} className={`${inputClass} text-center text-xl`} /></label>
              <div className="grid gap-2">
                <label className={labelClass}>Titel<input value={item.title} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, title: event.target.value } : other) })} maxLength={60} className={inputClass} /></label>
                <label className={labelClass}>Tekst<input value={item.text} onChange={(event) => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, text: event.target.value } : other) })} maxLength={300} className={inputClass} /></label>
              </div>
              <div className="flex flex-wrap gap-1 sm:col-span-2">
                {["🥜", "🌰", "🍫", "🍯", "☕", "🎁", "🚚", "⭐", "✅", "📦", "🌿", "❤️", "🎄", "🐣", "☀️", "🍂"].map((emoji) => (
                  <button key={emoji} type="button" onClick={() => onChange({ ...block, items: block.items.map((other, position) => position === index ? { ...other, icon: emoji } : other) })} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface text-lg" aria-label={`Icoon ${emoji}`}>{emoji}</button>
                ))}
              </div>
              {block.items.length > 1 ? <button type="button" onClick={() => onChange({ ...block, items: block.items.filter((_, position) => position !== index) })} className={`${smallButton} justify-self-start`}>Weghalen</button> : null}
            </div>
          ))}
          {block.items.length < 4 ? <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { icon: "⭐", title: "", text: "" }] })} className={`${smallButton} justify-self-start`}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Icoon toevoegen</button> : null}
        </div>
      );
    case "table":
      return (
        <div className="grid gap-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-body-sm">
            <thead><tr>{block.headers.map((header, column) => <th key={column} className="p-1"><input value={header} onChange={(event) => onChange({ ...block, headers: block.headers.map((other, position) => position === column ? event.target.value : other) })} placeholder={`Kop ${column + 1}`} className={`${inputClass} font-bold`} aria-label={`Kolomkop ${column + 1}`} /></th>)}<th /></tr></thead>
            <tbody>
              {block.rows.map((cells, rowIndex) => (
                <tr key={rowIndex}>
                  {cells.map((cell, column) => <td key={column} className="p-1"><input value={cell} onChange={(event) => onChange({ ...block, rows: block.rows.map((other, position) => position === rowIndex ? other.map((value, cellIndex) => cellIndex === column ? event.target.value : value) : other) })} className={inputClass} aria-label={`Rij ${rowIndex + 1}, kolom ${column + 1}`} /></td>)}
                  <td className="p-1"><button type="button" disabled={block.rows.length === 1} onClick={() => onChange({ ...block, rows: block.rows.filter((_, position) => position !== rowIndex) })} className={iconButton} aria-label={`Rij ${rowIndex + 1} verwijderen`}><X className="h-4 w-4" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={block.rows.length >= 30} onClick={() => onChange({ ...block, rows: [...block.rows, block.headers.map(() => "")] })} className={smallButton}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Rij</button>
            <button type="button" disabled={block.headers.length >= 6} onClick={() => onChange({ ...block, headers: [...block.headers, ""], rows: block.rows.map((cells) => [...cells, ""]) })} className={smallButton}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Kolom</button>
            <button type="button" disabled={block.headers.length <= 1} onClick={() => onChange({ ...block, headers: block.headers.slice(0, -1), rows: block.rows.map((cells) => cells.slice(0, -1)) })} className={smallButton}><Minus className="h-3.5 w-3.5" aria-hidden="true" />Kolom</button>
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-3">
          <label className={labelClass}>Citaat<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} rows={3} maxLength={1000} className={inputClass} /></label>
          <label className={labelClass}>Van wie (optioneel)<input value={block.author} onChange={(event) => onChange({ ...block, author: event.target.value })} maxLength={120} className={inputClass} /></label>
        </div>
      );
    case "divider":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Kleur" value={block.color} nullable onChange={(color) => onChange({ ...block, color })} />
          <Slider label="Dikte" value={block.thickness} min={1} max={4} suffix="px" onChange={(thickness) => onChange({ ...block, thickness })} />
        </div>
      );
    case "spacer":
      return <Slider label="Hoogte" value={Math.max(grid, Math.round(block.height / grid) * grid)} min={grid} max={96} step={grid} suffix="px" onChange={(height) => onChange({ ...block, height })} />;
    case "social":
      return (
        <div className="grid gap-3">
          {(["facebook", "instagram", "tiktok", "youtube", "website"] as const).map((key) => (
            <label key={key} className={labelClass}>{{ facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", website: "Website" }[key]}<input value={block.links[key]} onChange={(event) => onChange({ ...block, links: { ...block.links, [key]: event.target.value } })} placeholder="https://…" className={inputClass} /></label>
          ))}
          <AlignField value={block.align} onChange={(align) => onChange({ ...block, align })} />
        </div>
      );
    case "html":
      return (
        <label className={labelClass}>HTML (scripts en onveilige code worden verwijderd)<textarea value={block.html} onChange={(event) => onChange({ ...block, html: event.target.value })} rows={10} maxLength={50000} className={`${inputClass} font-mono text-body-sm`} /></label>
      );
  }
}

function blockSummary(block: NewsletterBlock): string {
  switch (block.type) {
    case "heading": return block.text;
    case "text": return block.text.replace(/\s+/gu, " ").slice(0, 80);
    case "image": return block.url ? block.alt || "Afbeelding" : "Nog geen afbeelding";
    case "video": return block.title || block.videoUrl || "Nog geen video";
    case "button": return block.text;
    case "products": return `${block.items.length} ${block.items.length === 1 ? "product" : "producten"}`;
    case "columns": return block.items.map((item) => item.heading).filter(Boolean).join(" · ") || `${block.count} kolommen`;
    case "icons": return block.items.map((item) => `${item.icon} ${item.title}`).join(" · ");
    case "table": return `${block.rows.length} ${block.rows.length === 1 ? "rij" : "rijen"}`;
    case "quote": return block.text.slice(0, 80);
    case "divider": return "Lijn";
    case "spacer": return `${block.height}px ruimte`;
    case "social": return Object.values(block.links).filter(Boolean).length + " links";
    case "html": return "Eigen HTML";
  }
}

function AddBlockMenu({ onAdd, compact }: { onAdd: (type: NewsletterBlockType) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={compact ? "flex justify-center" : ""}>
      {open ? (
        <div className="grid w-full gap-2 rounded-panel border border-accent/60 bg-surface p-3 shadow-card">
          <div className="flex items-center justify-between"><p className="font-heading text-body-sm font-bold text-text">Blok toevoegen</p><button type="button" onClick={() => setOpen(false)} className={iconButton} aria-label="Sluiten"><X className="h-4 w-4" aria-hidden="true" /></button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BLOCK_TYPES.map(({ type, label, hint, icon: Icon }) => (
              <button key={type} type="button" onClick={() => { onAdd(type); setOpen(false); }} className="flex min-h-11 items-start gap-2 rounded-button border border-border bg-background p-2 text-left hover:border-accent-ink">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
                <span><span className="block text-body-sm font-semibold text-text">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={compact ? "inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border bg-surface px-3 text-xs font-semibold text-muted hover:border-accent-ink hover:text-text" : "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-dashed border-border bg-surface font-heading text-body-sm font-bold text-text hover:border-accent-ink"}>
          <Plus className="h-4 w-4" aria-hidden="true" />{compact ? "Hier invoegen" : "Blok toevoegen"}
        </button>
      )}
    </div>
  );
}

function ThemeEditor({ theme, onChange }: { theme: NewsletterTheme; onChange: (theme: NewsletterTheme) => void }) {
  const set = <K extends keyof NewsletterTheme>(key: K, value: NewsletterTheme[K]) => onChange({ ...theme, [key]: value });
  return (
    <div className="grid gap-4">
      <ThemePresetBar theme={theme} onChange={onChange} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FontSelect label="Lettertype tekst" value={theme.font} onChange={(value) => set("font", value ?? "arial")} />
        <FontSelect label="Lettertype koppen" value={theme.headingFont} allowInherit onChange={(value) => set("headingFont", value)} />
        <Slider label="Breedte" value={theme.contentWidth} min={480} max={720} step={20} suffix="px" onChange={(value) => set("contentWidth", value)} />
        <Slider label="Afronding" value={theme.radius} min={0} max={24} suffix="px" onChange={(value) => set("radius", value)} />
      </div>
      <p className="-mt-2 text-xs text-muted">Google Fonts tonen in Apple Mail en iPhone; Gmail en Outlook gebruiken een gelijkend standaardlettertype.</p>
      <LayoutFields theme={theme} onChange={onChange} />
      <fieldset className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Kop van de mail</legend>
        <label className={labelClass}>Soort<select value={theme.header.mode} onChange={(event) => set("header", { ...theme.header, mode: event.target.value as NewsletterTheme["header"]["mode"] })} className={inputClass}><option value="text">Tekst</option><option value="logo">Logo</option><option value="none">Geen kop</option></select></label>
        {theme.header.mode !== "none" ? <label className={labelClass}>Tekst {theme.header.mode === "logo" ? "(alt-tekst van het logo)" : ""}<input value={theme.header.text} onChange={(event) => set("header", { ...theme.header, text: event.target.value })} maxLength={80} className={inputClass} /></label> : null}
        {theme.header.mode !== "none" ? <BrandLogoButtons onLogo={(logoUrl) => set("header", { ...theme.header, mode: "logo", logoUrl, text: theme.header.text || "De Notenman" })} /> : null}
        {theme.header.mode === "logo" ? (
          <>
            <ImageField label="Logo" value={theme.header.logoUrl} onChange={(logoUrl) => set("header", { ...theme.header, logoUrl })} />
            <Slider label="Breedte logo" value={theme.header.logoWidth} min={60} max={400} step={10} suffix="px" onChange={(logoWidth) => set("header", { ...theme.header, logoWidth })} />
          </>
        ) : null}
        {theme.header.mode !== "none" ? <AlignField value={theme.header.align} onChange={(align) => set("header", { ...theme.header, align })} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Achtergrond kop" value={theme.headerBackground} onChange={(value) => set("headerBackground", value ?? theme.headerBackground)} />
          <ColorField label="Tekst kop" value={theme.headerText} onChange={(value) => set("headerText", value ?? theme.headerText)} />
        </div>
      </fieldset>
      <fieldset className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3 sm:grid-cols-2">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Kleuren</legend>
        <ColorField label="Achtergrond pagina" value={theme.pageBackground} onChange={(value) => set("pageBackground", value ?? theme.pageBackground)} />
        <ColorField label="Achtergrond mail" value={theme.contentBackground} onChange={(value) => set("contentBackground", value ?? theme.contentBackground)} />
        <ColorField label="Tekst" value={theme.text} onChange={(value) => set("text", value ?? theme.text)} />
        <ColorField label="Koppen" value={theme.heading} onChange={(value) => set("heading", value ?? theme.heading)} />
        <ColorField label="Accent (knoppen)" value={theme.accent} onChange={(value) => set("accent", value ?? theme.accent)} />
        <ColorField label="Tekst op knoppen" value={theme.accentText} onChange={(value) => set("accentText", value ?? theme.accentText)} />
        <ColorField label="Links" value={theme.link} onChange={(value) => set("link", value ?? theme.link)} />
      </fieldset>
      <fieldset className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Voet van de mail</legend>
        <RichTextField label="Tekst" value={theme.footer.text} rows={3} onChange={(text) => set("footer", { ...theme.footer, text })} />
        <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="checkbox" checked={theme.footer.showArchiveLink} onChange={(event) => set("footer", { ...theme.footer, showArchiveLink: event.target.checked })} />Link &quot;Bekijk in je browser&quot; bovenaan</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Achtergrond voet" value={theme.footerBackground} onChange={(value) => set("footerBackground", value ?? theme.footerBackground)} />
          <ColorField label="Tekst voet" value={theme.footerText} onChange={(value) => set("footerText", value ?? theme.footerText)} />
        </div>
        <p className="text-xs text-muted">Het afzenderadres en de afmeldlink staan er altijd in; dat is wettelijk verplicht.</p>
      </fieldset>
    </div>
  );
}

/** Renders the email at its real desktop width and scales it down to fit the column. */
function ScaledPreview({ html, width }: { html: string; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  const height = 900;
  return (
    <div className="rounded-panel border border-border bg-surface p-2 shadow-card">
      {/* Absolute, so the iframe's real width never widens the page. */}
      <div ref={box} className="relative w-full overflow-hidden" style={{ height: height * scale }}>
        <iframe title="Desktopvoorbeeld nieuwsbrief" sandbox="" srcDoc={html} className="absolute left-0 top-0 origin-top-left rounded-button bg-white" style={{ width, height, transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}

// ---------- Editor ----------

type NewsletterEditorFormProps = {
  mode: "create" | "edit";
  initial: NewsletterDraft;
  initialDocument: NewsletterDocument;
  recipientCount: number;
  businessRecipientCount: number;
  businessSegmentReady: boolean;
  campaignId?: string;
  campaignStatus?: string;
};

export function NewsletterEditorForm({
  mode,
  initial,
  initialDocument,
  recipientCount,
  businessRecipientCount,
  businessSegmentReady,
  campaignId,
  campaignStatus = "save",
}: NewsletterEditorFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [document, setDocument] = useState(initialDocument);
  const [openBlock, setOpenBlock] = useState<string | null>(initialDocument.blocks[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showGrid, setShowGrid] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const editable = mode === "create" || campaignStatus === "save";
  const preview = useMemo(() => renderNewsletterEmail(document, { subject: draft.subject, previewText: draft.previewText }, { preview: true, showGrid }), [document, draft.subject, draft.previewText, showGrid]);
  const audienceRecipientCount = draft.audience === "custom" ? "bestaande selectie van" : draft.audience === "segment" ? "de gekozen" : recipientCountForAudience(draft.audience, recipientCount, businessRecipientCount);

  function setTargeting(targeting: NewsletterTargeting) {
    setDraft((current) => ({ ...current, targeting }));
    setDirty(true);
    setMessage(null);
  }

  function update(field: Exclude<keyof NewsletterDraft, "targeting">, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage(null);
  }

  function changeDocument(next: NewsletterDocument) {
    setDocument(next);
    setDirty(true);
    setMessage(null);
  }

  function updateBlock(next: NewsletterBlock) {
    // Functional update: block editors may report results of uploads that finished later.
    setDocument((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === next.id ? next : block) }));
    setDirty(true);
    setMessage(null);
  }

  function insertBlock(type: NewsletterBlockType, index: number) {
    const block = createNewsletterBlock(type);
    const blocks = [...document.blocks];
    blocks.splice(index, 0, block);
    changeDocument({ ...document, blocks });
    setOpenBlock(block.id);
  }

  function moveBlock(index: number, delta: number) {
    const blocks = [...document.blocks];
    const [block] = blocks.splice(index, 1);
    blocks.splice(index + delta, 0, block);
    changeDocument({ ...document, blocks });
  }

  function dropBlock(target: number) {
    if (dragIndex === null) return;
    const blocks = [...document.blocks];
    const [block] = blocks.splice(dragIndex, 1);
    blocks.splice(target > dragIndex ? target - 1 : target, 0, block);
    setDragIndex(null);
    setDropIndex(null);
    if (target !== dragIndex && target !== dragIndex + 1) changeDocument({ ...document, blocks });
  }

  function duplicateBlock(index: number) {
    const copy = { ...structuredClone(document.blocks[index]), id: newBlockId() };
    const blocks = [...document.blocks];
    blocks.splice(index + 1, 0, copy);
    changeDocument({ ...document, blocks });
    setOpenBlock(copy.id);
  }

  function removeBlock(index: number) {
    if (document.blocks.length === 1) return;
    if (!window.confirm(`Blok "${blockLabel(document.blocks[index].type)}" verwijderen?`)) return;
    changeDocument({ ...document, blocks: document.blocks.filter((_, position) => position !== index) });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.audience === "segment") {
      const problem = targetingProblem(draft.targeting);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy("save");
    setError(null);
    setMessage(null);
    const endpoint = mode === "create" ? "/api/admin/marketing/newsletters" : `/api/admin/marketing/newsletters/${campaignId}`;
    try {
      // The server renders the email from the blocks itself; contentHtml only fills the local record.
      const contentHtml = extractNewsletterContent(renderNewsletterEmail(document, draft));
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, targeting: draft.audience === "segment" ? draft.targeting : undefined, contentHtml, document }),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const body = (await response.json()) as { campaign?: { id?: string } };
      setDirty(false);
      if (mode === "create" && body.campaign?.id) {
        router.push(`/admin/marketing/nieuwsbrieven/${body.campaign.id}`);
        return;
      }
      setMessage("Wijzigingen opgeslagen in Mailchimp.");
      router.refresh();
    } catch {
      setError("Opslaan mislukt door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  function requireSaved(): boolean {
    if (!dirty) return true;
    setError("Sla de wijzigingen eerst op voordat je deze actie uitvoert.");
    return false;
  }

  async function postAction(action: "test" | "schedule" | "send", body: object) {
    if (!campaignId || !requireSaved()) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/marketing/newsletters/${campaignId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      setMessage(action === "test" ? "Testmail aangevraagd." : action === "schedule" ? "Nieuwsbrief ingepland." : "Nieuwsbrief wordt verzonden.");
      router.refresh();
    } catch {
      setError("De actie mislukte door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    const emails = [...new Set(testEmail.split(/[\s,;]+/u).map((value) => value.trim()).filter(Boolean))];
    if (!emails.length || emails.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value))) {
      setError("Vul geldige testadressen in, gescheiden door komma's.");
      return;
    }
    if (emails.length > 10) {
      setError("Stuur een testmail naar maximaal 10 adressen tegelijk.");
      return;
    }
    await postAction("test", { emails });
  }

  async function schedule() {
    if (!scheduleTime) {
      setError("Kies een verzendmoment.");
      return;
    }
    if (!window.confirm(`Deze nieuwsbrief inplannen voor ${scheduleTime}?`)) return;
    await postAction("schedule", { scheduleTime: new Date(scheduleTime).toISOString(), confirm: true });
  }

  async function send() {
    if (!window.confirm(`Nu definitief versturen naar ${audienceRecipientCount} ontvangers? Dit kan niet ongedaan worden gemaakt.`)) return;
    await postAction("send", { confirm: true });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]">
      <form onSubmit={save} className="grid min-w-0 content-start gap-5">
        <fieldset disabled={!editable || busy !== null} className="grid min-w-0 gap-5 disabled:opacity-70 [&>*]:min-w-0">
          <details open={mode === "create"} className="rounded-panel border border-border bg-surface p-4 shadow-card md:p-5">
            <summary className="cursor-pointer font-heading text-heading-sm font-bold text-text">Algemeen: onderwerp, afzender en doelgroep</summary>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>Interne campagnenaam<input required maxLength={150} value={draft.title} onChange={(event) => update("title", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Onderwerp<input required maxLength={150} value={draft.subject} onChange={(event) => update("subject", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Previewtekst (grijze regel onder het onderwerp in de inbox)<input maxLength={255} value={draft.previewText} onChange={(event) => update("previewText", event.target.value)} className={inputClass} /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>Afzendernaam<input required maxLength={100} value={draft.fromName} onChange={(event) => update("fromName", event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Antwoordadres<input type="email" required value={draft.replyTo} onChange={(event) => update("replyTo", event.target.value)} className={inputClass} /></label>
              </div>
              <div>
                <p className="text-body-sm font-semibold text-text">Doelgroep</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...(mode === "edit" ? [{ value: "custom" as const, label: "Bestaande selectie behouden" }] : []), ...AUDIENCE_OPTIONS].map((option) => {
                    const disabled = (option.value === "zakelijk" || option.value === "particulier") && !businessSegmentReady;
                    return (
                      <label key={option.value} className={`flex min-h-11 items-center gap-2 rounded-button border px-3 py-2 text-body-sm ${draft.audience === option.value ? "border-accent bg-accent/10" : "border-border bg-background"} ${disabled ? "opacity-50" : ""}`}>
                        <input type="radio" name="newsletter-audience" value={option.value} checked={draft.audience === option.value} disabled={disabled} onChange={() => update("audience", option.value)} />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {draft.audience === "segment" ? <AudienceSegmentPicker value={draft.targeting} onChange={setTargeting} disabled={!editable} /> : null}
                <p className="mt-1 text-xs text-muted">
                  {draft.audience === "custom" ? "De bestaande Mailchimp-selectie blijft behouden." : draft.audience === "segment" ? "" : `${audienceRecipientCount} ontvangers bij deze keuze.`}
                  {!businessSegmentReady ? " Synchroniseer eerst de zakelijke contacten om op zakelijk/particulier te kunnen richten." : ""}
                </p>
              </div>
            </div>
          </details>

          <section className="grid min-w-0 gap-2 [&>*]:min-w-0" aria-labelledby="blocks-title">
            <h2 id="blocks-title" className="font-heading text-heading-md text-text">Inhoud</h2>
            {document.blocks.map((block, index) => {
              const open = openBlock === block.id;
              const Icon = BLOCK_TYPES.find((item) => item.type === block.type)?.icon ?? Type;
              return (
                <div key={block.id} className="grid min-w-0 gap-2">
                  {editable && index > 0 ? <AddBlockMenu compact onAdd={(type) => insertBlock(type, index)} /> : null}
                  <article
                    onDragOver={(event) => { if (dragIndex === null) return; event.preventDefault(); const box = event.currentTarget.getBoundingClientRect(); setDropIndex(event.clientY < box.top + box.height / 2 ? index : index + 1); }}
                    onDrop={(event) => { event.preventDefault(); if (dropIndex !== null) dropBlock(dropIndex); }}
                    className={`min-w-0 rounded-panel border bg-surface shadow-card ${open ? "border-accent-ink" : "border-border"} ${dragIndex === index ? "opacity-50" : ""} ${dropIndex === index && dragIndex !== null ? "border-t-4 border-t-accent" : ""} ${dropIndex === index + 1 && dragIndex !== null && index === document.blocks.length - 1 ? "border-b-4 border-b-accent" : ""}`}
                  >
                    <div className="flex items-center gap-2 p-2 pl-3 sm:pl-1">
                      {editable ? (
                        <span
                          draggable
                          onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); setDragIndex(index); }}
                          onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                          className="hidden h-11 w-6 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing sm:inline-flex"
                          title="Sleep om te verplaatsen"
                          aria-hidden="true"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                      ) : null}
                      <button type="button" onClick={() => setOpenBlock(open ? null : block.id)} aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                        <Icon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
                        <span className="min-w-0"><span className="block text-body-sm font-bold text-text">{blockLabel(block.type)}</span><span className="block truncate text-xs text-muted">{blockSummary(block)}</span></span>
                      </button>
                      {editable ? (
                        <span className="flex shrink-0 gap-1">
                          <button type="button" disabled={index === 0} onClick={() => moveBlock(index, -1)} className={iconButton} aria-label="Blok omhoog"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                          <button type="button" disabled={index === document.blocks.length - 1} onClick={() => moveBlock(index, 1)} className={iconButton} aria-label="Blok omlaag"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                          <button type="button" onClick={() => duplicateBlock(index)} className={`${iconButton} hidden sm:inline-flex`} aria-label="Blok dupliceren"><Copy className="h-4 w-4" aria-hidden="true" /></button>
                          <button type="button" disabled={document.blocks.length === 1} onClick={() => removeBlock(index)} className={`${iconButton} text-red-700`} aria-label="Blok verwijderen"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        </span>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="border-t border-border p-3 sm:p-4">
                        <BlockFields block={block} onChange={updateBlock} grid={document.theme.gridSize} />
                        <BlockStyleFields style={block.style} grid={document.theme.gridSize} onChange={(style) => updateBlock({ ...block, style } as NewsletterBlock)} />
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })}
            {editable ? <AddBlockMenu onAdd={(type) => insertBlock(type, document.blocks.length)} /> : null}
          </section>

          <details className="rounded-panel border border-border bg-surface p-4 shadow-card md:p-5">
            <summary className="cursor-pointer font-heading text-heading-sm font-bold text-text">Ontwerp: kleuren, lettertype, kop en voet</summary>
            <div className="mt-4"><ThemeEditor theme={document.theme} onChange={(theme) => changeDocument({ ...document, theme })} /></div>
          </details>
        </fieldset>

        {error ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-800">{error}</p> : null}
        {message ? <p role="status" className="rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800">{message}</p> : null}

        {editable ? (
          <div className="sticky bottom-0 z-20 -mx-1 flex items-center gap-3 rounded-panel border border-border bg-surface/95 p-3 shadow-card backdrop-blur">
            <p className="min-w-0 flex-1 text-body-sm text-muted">{dirty ? "Niet-opgeslagen wijzigingen" : "Alles is opgeslagen"}</p>
            <button type="submit" disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">
              {busy === "save" ? "Opslaan…" : mode === "create" ? "Concept maken" : "Wijzigingen opslaan"}
            </button>
          </div>
        ) : null}

        {mode === "edit" && editable ? (
          <section className="rounded-panel border border-border bg-surface p-4 shadow-card md:p-5" aria-label="Verzenden">
            <div className="rounded-panel border border-accent/40 bg-accent/10 p-4">
              <p className="font-heading text-body-sm font-bold text-text">Verzendcontrole · {audienceRecipientCount} ontvangers</p>
              <p className="mt-1 text-xs text-muted">Test eerst. Definitief versturen kan niet ongedaan worden gemaakt.</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <input type="text" inputMode="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="test@voorbeeld.nl, collega@voorbeeld.nl" aria-label="Testmailadressen, gescheiden door komma's" className={inputClass} />
              <button type="button" onClick={sendTest} disabled={busy !== null} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Testmail sturen</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
              <input type="datetime-local" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} aria-label="Verzendmoment" className={inputClass} />
              <button type="button" onClick={schedule} disabled={busy !== null} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Inplannen</button>
              <button type="button" onClick={send} disabled={busy !== null} className="min-h-11 rounded-button bg-red-700 px-4 font-heading text-body-sm font-bold text-white disabled:opacity-60">Nu versturen</button>
            </div>
          </section>
        ) : null}
      </form>

      <aside className="grid min-w-0 content-start gap-3 xl:sticky xl:top-20 xl:self-start" aria-label="Nieuwsbriefvoorbeeld">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-heading-md text-text">Live voorbeeld</h2>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Voorbeeldopties">
            <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid((value) => !value)} className={`${smallButton} min-h-11 ${showGrid ? "border-accent-ink bg-accent/15" : ""}`}><Grid3x3 className="h-4 w-4" aria-hidden="true" />Raster</button>
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={`${smallButton} min-h-11 ${device === "desktop" ? "border-accent-ink bg-accent/15" : ""}`}><Monitor className="h-4 w-4" aria-hidden="true" />Desktop</button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={`${smallButton} min-h-11 ${device === "mobile" ? "border-accent-ink bg-accent/15" : ""}`}><Smartphone className="h-4 w-4" aria-hidden="true" />Mobiel</button>
          </div>
        </div>
        <div className="rounded-panel border border-border bg-surface p-3 shadow-card" aria-label="Zo verschijnt de mail in de inbox">
          <p className="flex items-baseline gap-2 text-body-sm"><strong className="truncate text-text">{draft.fromName || "De Notenman"}</strong><span className="ml-auto shrink-0 text-xs text-muted">nu</span></p>
          <p className="truncate text-body-sm font-semibold text-text">{draft.subject || "Onderwerp"}</p>
          <p className="truncate text-xs text-muted">{draft.previewText || "Previewtekst"}</p>
        </div>
        {device === "mobile" ? (
          <div className="mx-auto w-full max-w-[390px] rounded-[28px] border-8 border-contrast bg-surface p-1 shadow-card">
            <iframe title="Mobiel voorbeeld nieuwsbrief" sandbox="" srcDoc={preview} className="h-[680px] w-full rounded-[18px] bg-white" />
          </div>
        ) : (
          <ScaledPreview html={preview} width={document.theme.contentWidth + 80} />
        )}
        <p className="text-xs text-muted">Het voorbeeld gebruikt dezelfde opmaak als de verzonden mail. *|FNAME|* toont hier &quot;Fedor&quot;.</p>
      </aside>
    </div>
  );
}
