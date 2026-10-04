"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Palette, Save, Trash2 } from "lucide-react";

import {
  DEFAULT_BLOCK_STYLE,
  NEWSLETTER_FONTS,
  NEWSLETTER_GRID_SIZES,
  snapToGrid,
  type NewsletterBlockStyle,
  type NewsletterTheme,
} from "@/lib/newsletter/document";
import { applyThemePreset, BUILT_IN_THEME_PRESETS, type NewsletterThemePreset } from "@/lib/newsletter/theme-presets";

const inputClass = "min-h-11 w-full min-w-0 rounded-button border border-border bg-background px-3 py-2 text-base text-text";
const labelClass = "grid gap-1 text-body-sm font-semibold text-text";
const smallButton = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold text-text disabled:opacity-40";

const WEB_SAFE = Object.entries(NEWSLETTER_FONTS).filter(([, font]) => !("google" in font));
const GOOGLE = Object.entries(NEWSLETTER_FONTS).filter(([, font]) => "google" in font);
const OTHER_GOOGLE = "__other_google__";

/** Font picker: web-safe fonts, curated Google Fonts, or any other Google Font by name. */
export function FontSelect({ label, value, onChange, allowInherit }: { label: string; value: string | null; onChange: (value: string | null) => void; allowInherit?: boolean }) {
  const isCustom = Boolean(value?.startsWith("google:"));
  const [custom, setCustom] = useState(isCustom && value ? value.slice("google:".length) : "");
  const [showCustom, setShowCustom] = useState(isCustom);
  const selectValue = showCustom ? OTHER_GOOGLE : value ?? "";
  return (
    <div className="grid gap-1">
      <label className={labelClass}>{label}
        <select
          value={selectValue}
          onChange={(event) => {
            const next = event.target.value;
            if (next === OTHER_GOOGLE) {
              setShowCustom(true);
              if (/^[A-Za-z][A-Za-z0-9 ]{1,39}$/u.test(custom.trim())) onChange(`google:${custom.trim()}`);
              return;
            }
            setShowCustom(false);
            onChange(next === "" ? null : next);
          }}
          className={inputClass}
          style={value && !showCustom && Object.hasOwn(NEWSLETTER_FONTS, value) ? { fontFamily: NEWSLETTER_FONTS[value as keyof typeof NEWSLETTER_FONTS].stack } : undefined}
        >
          {allowInherit ? <option value="">Zelfde als tekst</option> : null}
          <optgroup label="Werkt in elke mail-app">
            {WEB_SAFE.map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
          </optgroup>
          <optgroup label="Google Fonts">
            {GOOGLE.map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
            <option value={OTHER_GOOGLE}>Andere Google Font…</option>
          </optgroup>
        </select>
      </label>
      {showCustom ? (
        <input
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            const family = event.target.value.trim();
            if (/^[A-Za-z][A-Za-z0-9 ]{1,39}$/u.test(family)) onChange(`google:${family}`);
          }}
          placeholder="Naam zoals op fonts.google.com, bv. Josefin Sans"
          aria-label={`${label}: naam van de Google Font`}
          className={inputClass}
        />
      ) : null}
    </div>
  );
}

/** Built-in looks, saved house styles and saving the current look. */
export function ThemePresetBar({ theme, onChange }: { theme: NewsletterTheme; onChange: (theme: NewsletterTheme) => void }) {
  const [saved, setSaved] = useState<NewsletterThemePreset[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/newsletter/theme-presets", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { presets?: NewsletterThemePreset[] }) => { if (active) setSaved(body.presets ?? []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function request(method: "POST" | "DELETE", init: { body?: string; query?: string }) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/newsletter/theme-presets${init.query ?? ""}`, { method, headers: { "content-type": "application/json" }, body: init.body });
      const body = await response.json().catch(() => ({})) as { presets?: NewsletterThemePreset[]; message?: string };
      if (!response.ok) throw new Error(body.message || "Opslaan mislukt.");
      setSaved(body.presets ?? []);
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Opslaan mislukt.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setMessage("Geef de huisstijl een naam.");
      return;
    }
    if (await request("POST", { body: JSON.stringify({ name: name.trim(), theme }) })) {
      setMessage(`Huisstijl “${name.trim()}” opgeslagen.`);
      setName("");
    }
  }

  return (
    <fieldset className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Huisstijl en voorbeelden</legend>
      <div className="flex flex-wrap gap-2">
        {BUILT_IN_THEME_PRESETS.map((preset) => (
          <button key={preset.id} type="button" onClick={() => onChange(applyThemePreset(theme, preset.theme))} className={`${smallButton} min-h-11`}>
            <span aria-hidden="true" className="flex">
              {[preset.theme.headerBackground, preset.theme.accent, preset.theme.pageBackground].map((swatch, index) => <span key={index} className="h-4 w-4 rounded-full border border-border" style={{ background: swatch, marginLeft: index ? -4 : 0 }} />)}
            </span>
            {preset.name}
          </button>
        ))}
      </div>
      {saved.length ? (
        <ul className="grid gap-1" aria-label="Opgeslagen huisstijlen">
          {saved.map((preset) => (
            <li key={preset.id} className="flex items-center gap-2 rounded-button border border-border bg-surface p-2">
              <Palette className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
              <button type="button" onClick={() => onChange(applyThemePreset(theme, preset.theme))} className="min-h-9 min-w-0 flex-1 truncate text-left text-body-sm font-semibold">{preset.name}</button>
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Huisstijl “${preset.name}” verwijderen?`)) void request("DELETE", { query: `?id=${encodeURIComponent(preset.id)}` }); }} className="inline-flex h-9 w-9 items-center justify-center rounded-button border border-border text-red-700" aria-label={`${preset.name} verwijderen`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Naam, bv. Najaarsactie" aria-label="Naam voor deze huisstijl" className={inputClass} />
        <button type="button" onClick={() => void save()} disabled={busy} className={`${smallButton} min-h-11 shrink-0`}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Opslaan als huisstijl</button>
      </div>
      {message ? <p role="status" className="text-xs font-semibold text-text">{message}</p> : null}
    </fieldset>
  );
}

/** Puts the De Notenman wordmark in the header, dark or white. */
export function BrandLogoButtons({ onLogo }: { onLogo: (url: string) => void }) {
  const [busy, setBusy] = useState<"dark" | "light" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load(variant: "dark" | "light") {
    setBusy(variant);
    setError(null);
    try {
      const response = await fetch("/api/admin/newsletter/brand-logo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variant }) });
      const body = await response.json().catch(() => ({})) as { logoUrl?: string; message?: string };
      if (!response.ok || !body.logoUrl) throw new Error(body.message || "Logo laden mislukt.");
      onLogo(body.logoUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logo laden mislukt.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        {(["dark", "light"] as const).map((variant) => (
          <button key={variant} type="button" disabled={busy !== null} onClick={() => void load(variant)} className={`${smallButton} min-h-11`}>
            {busy === variant ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {variant === "dark" ? "Logo De Notenman (donker)" : "Logo De Notenman (wit)"}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function GridSlider({ label, value, max, grid, onChange }: { label: string; value: number; max: number; grid: number; onChange: (value: number) => void }) {
  return (
    <label className={labelClass}>
      <span className="flex justify-between">{label}<span className="text-muted">{snapToGrid(value, grid)}px</span></span>
      <input type="range" min={0} max={max} step={grid} value={snapToGrid(value, grid)} onChange={(event) => onChange(Number(event.target.value))} className="min-h-11 w-full accent-[color:var(--color-accent-ink,#6b5b00)]" />
    </label>
  );
}

/** Background and spacing for one block; spacing snaps to the theme grid. */
export function BlockStyleFields({ style, grid, onChange }: { style: NewsletterBlockStyle | undefined; grid: number; onChange: (style: NewsletterBlockStyle | undefined) => void }) {
  const value = style ?? DEFAULT_BLOCK_STYLE;
  const set = (changes: Partial<NewsletterBlockStyle>) => {
    const next = { ...value, ...changes };
    onChange(next.background === null && next.paddingTop === 0 && next.paddingBottom === 0 ? undefined : next);
  };
  return (
    <details className="mt-3 rounded-card border border-border bg-background p-3" open={Boolean(style)}>
      <summary className="cursor-pointer text-body-sm font-semibold text-text">Achtergrond en ruimte</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Achtergrond
          <span className="flex items-center gap-2">
            <input type="color" value={value.background ?? "#ffffff"} onChange={(event) => set({ background: event.target.value })} className="h-11 w-14 shrink-0 rounded-button border border-border bg-background" aria-label="Achtergrondkleur blok" />
            <button type="button" onClick={() => set({ background: null })} disabled={!value.background} className={smallButton}>Geen</button>
          </span>
        </label>
        <span className="hidden sm:block" />
        <GridSlider label="Ruimte boven" value={value.paddingTop} max={96} grid={grid} onChange={(paddingTop) => set({ paddingTop })} />
        <GridSlider label="Ruimte onder" value={value.paddingBottom} max={96} grid={grid} onChange={(paddingBottom) => set({ paddingBottom })} />
      </div>
    </details>
  );
}

/** Layout settings: grid, side padding and button look. */
export function LayoutFields({ theme, onChange }: { theme: NewsletterTheme; onChange: (theme: NewsletterTheme) => void }) {
  const set = <K extends keyof NewsletterTheme>(key: K, value: NewsletterTheme[K]) => onChange({ ...theme, [key]: value });
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-card border border-border bg-background p-3 sm:grid-cols-2">
      <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">Layout en raster</legend>
      <label className={labelClass}>Raster (alles klikt hierop vast)
        <select value={theme.gridSize} onChange={(event) => set("gridSize", Number(event.target.value) as NewsletterTheme["gridSize"])} className={inputClass}>
          {NEWSLETTER_GRID_SIZES.map((size) => <option key={size} value={size}>{size} px</option>)}
        </select>
      </label>
      <GridSlider label="Zijmarge" value={theme.paddingX} max={48} grid={theme.gridSize} onChange={(paddingX) => set("paddingX", Math.max(16, paddingX))} />
      <label className={labelClass}>Knopstijl
        <select value={theme.buttonStyle} onChange={(event) => set("buttonStyle", event.target.value as NewsletterTheme["buttonStyle"])} className={inputClass}>
          <option value="filled">Gevuld</option>
          <option value="outline">Omlijnd</option>
        </select>
      </label>
      <label className={labelClass}>
        <span className="flex justify-between">Knopafronding<span className="text-muted">{theme.buttonRadius === null ? "volgt afronding" : `${theme.buttonRadius}px`}</span></span>
        <span className="flex items-center gap-2">
          <input type="range" min={0} max={40} step={2} value={theme.buttonRadius ?? Math.min(theme.radius, 12)} onChange={(event) => set("buttonRadius", Number(event.target.value))} className="min-h-11 w-full accent-[color:var(--color-accent-ink,#6b5b00)]" />
          {theme.buttonRadius !== null ? <button type="button" onClick={() => set("buttonRadius", null)} className={smallButton}>Standaard</button> : null}
        </span>
      </label>
    </fieldset>
  );
}
