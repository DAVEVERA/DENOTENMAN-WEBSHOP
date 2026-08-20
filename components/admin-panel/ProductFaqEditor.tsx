"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  Plus,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { FaqRichTextEditor } from "@/components/admin-panel/FaqRichTextEditor";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

type FaqLocale = "nl" | "en" | "fr";
type FaqStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";
type FaqPlacement = "BELOW_DESCRIPTION" | "BELOW_PRODUCT_DETAILS" | "BEFORE_REVIEWS" | "PAGE_BOTTOM";
type FaqMediaType = "IMAGE" | "INSTRUCTION" | "INFOGRAPHIC";

type FaqTranslation = {
  locale: FaqLocale;
  question: string;
  answerHtml: string;
  mediaLabel: string;
};

type FaqMedia = {
  id: string;
  type: FaqMediaType;
  url?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
};

type FaqItem = {
  id: string;
  status: FaqStatus;
  placement: FaqPlacement;
  sortOrder: number;
  version: string | number;
  translations: Record<FaqLocale, FaqTranslation>;
  media: FaqMedia | null;
};

type FaqSet = { revision: string | number; items: FaqItem[] };

const locales: Array<{ id: FaqLocale; label: string }> = [
  { id: "nl", label: "Nederlands" },
  { id: "en", label: "Engels" },
  { id: "fr", label: "Frans" },
];

const placements: Array<{ id: FaqPlacement; label: string }> = [
  { id: "BELOW_DESCRIPTION", label: "Onder de productomschrijving" },
  { id: "BELOW_PRODUCT_DETAILS", label: "Onder productdetails" },
  { id: "BEFORE_REVIEWS", label: "Boven reviews" },
  { id: "PAGE_BOTTOM", label: "Onderaan de productpagina" },
];

const statusLabels: Record<FaqStatus, string> = {
  DRAFT: "Concept",
  PUBLISHED: "Gepubliceerd",
  HIDDEN: "Verborgen",
};

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 py-2 text-body-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border bg-white px-3 text-body-sm font-semibold text-text hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

function blankTranslation(locale: FaqLocale): FaqTranslation {
  return { locale, question: "", answerHtml: "", mediaLabel: "" };
}

function translationRecord(input: unknown): Record<FaqLocale, FaqTranslation> {
  const result = { nl: blankTranslation("nl"), en: blankTranslation("en"), fr: blankTranslation("fr") };
  const list = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? Object.values(input as Record<string, unknown>)
      : [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<FaqTranslation>;
    if (candidate.locale !== "nl" && candidate.locale !== "en" && candidate.locale !== "fr") continue;
    result[candidate.locale] = {
      locale: candidate.locale,
      question: typeof candidate.question === "string" ? candidate.question : "",
      answerHtml: typeof candidate.answerHtml === "string" ? candidate.answerHtml : "",
      mediaLabel: typeof candidate.mediaLabel === "string" ? candidate.mediaLabel : "",
    };
  }
  return result;
}

function normalizeSet(payload: unknown): FaqSet {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const source = (root.faqSet ?? root.set ?? root.data ?? root) as Record<string, unknown>;
  const items = Array.isArray(source.items) ? source.items : [];
  return {
    revision: typeof source.revision === "number" || typeof source.revision === "string" ? source.revision : 0,
    items: items.flatMap((raw): FaqItem[] => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (typeof item.id !== "string") return [];
      const draft = item.draft && typeof item.draft === "object"
        ? item.draft as Record<string, unknown>
        : item.published && typeof item.published === "object"
          ? item.published as Record<string, unknown>
          : {};
      return [{
        id: item.id,
        status: item.status === "PUBLISHED" || item.status === "HIDDEN" ? item.status : "DRAFT",
        placement: placements.some((placement) => placement.id === item.placement)
          ? item.placement as FaqPlacement
          : "BELOW_PRODUCT_DETAILS",
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
        version: typeof item.version === "number" || typeof item.version === "string" ? item.version : 0,
        translations: translationRecord(draft.translations),
        media: draft.media && typeof draft.media === "object" ? draft.media as FaqMedia : null,
      }];
    }).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
  };
}

function apiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const body = payload as { error?: unknown; message?: unknown };
    if (body.error === "STALE_FAQ_SET") return "De FAQ is intussen elders gewijzigd. De nieuwste versie wordt geladen.";
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  }
  return fallback;
}

function faqLocaleTabId(itemId: string, locale: FaqLocale): string {
  return `faq-locale-tab-${itemId}-${locale}`;
}

function faqLocalePanelId(itemId: string): string {
  return `faq-locale-panel-${itemId}`;
}

export function ProductFaqEditor({ productId }: { productId: string }) {
  const [faqSet, setFaqSet] = useState<FaqSet>({ revision: 0, items: [] });
  const [localeByItem, setLocaleByItem] = useState<Record<string, FaqLocale>>({});
  const [phase, setPhase] = useState<"loading" | "idle" | "saving">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dirtyItemIds, setDirtyItemIds] = useState<Set<string>>(() => new Set());

  const endpoint = `/api/admin/products/${productId}/faqs`;
  const activeCount = faqSet.items.length;

  const load = useCallback(async (announce = false) => {
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(payload, "De veelgestelde vragen konden niet worden geladen."));
      setFaqSet(normalizeSet(payload));
      setDirtyItemIds(new Set());
      if (announce) setMessage("De nieuwste FAQ-versie is geladen.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De veelgestelde vragen konden niet worden geladen.");
    } finally {
      setPhase("idle");
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(url: string, init: RequestInit, success: string, committedItemId?: string): Promise<boolean> {
    setPhase("saving");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) void load(true);
        throw new Error(apiMessage(payload, "De wijziging kon niet worden opgeslagen."));
      }
      const canonical = normalizeSet(payload);
      setFaqSet((current) => {
        const unsaved = new Map(current.items
          .filter((item) => dirtyItemIds.has(item.id) && item.id !== committedItemId)
          .map((item) => [item.id, item]));
        return { ...canonical, items: canonical.items.map((item) => unsaved.get(item.id) ?? item) };
      });
      if (committedItemId) {
        setDirtyItemIds((current) => {
          const next = new Set(current);
          next.delete(committedItemId);
          return next;
        });
      }
      setPhase("idle");
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De wijziging kon niet worden opgeslagen.");
      setPhase("idle");
      return false;
    }
  }

  function updateItem(id: string, update: (item: FaqItem) => FaqItem) {
    setMessage(null);
    setDirtyItemIds((current) => new Set(current).add(id));
    setFaqSet((current) => ({ ...current, items: current.items.map((item) => item.id === id ? update(item) : item) }));
  }

  function selectLocale(itemId: string, locale: FaqLocale, focus = false) {
    setLocaleByItem((current) => ({ ...current, [itemId]: locale }));
    if (focus) {
      window.requestAnimationFrame(() => document.getElementById(faqLocaleTabId(itemId, locale))?.focus());
    }
  }

  function navigateLocaleTabs(event: KeyboardEvent<HTMLButtonElement>, itemId: string, locale: FaqLocale) {
    const index = locales.findIndex((candidate) => candidate.id === locale);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % locales.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + locales.length) % locales.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = locales.length - 1;
    else return;
    event.preventDefault();
    selectLocale(itemId, locales[nextIndex].id, true);
  }

  async function addItem() {
    const idempotencyKey = crypto.randomUUID();
    await mutate(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        expectedRevision: faqSet.revision,
        idempotencyKey,
        placement: "BELOW_PRODUCT_DETAILS",
        translations: [],
      }),
    }, "Conceptvraag toegevoegd.");
  }

  async function saveItem(item: FaqItem) {
    const idempotencyKey = crypto.randomUUID();
    await mutate(`${endpoint}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        expectedRevision: faqSet.revision,
        itemVersion: item.version,
        idempotencyKey,
        placement: item.placement,
        translations: locales.map(({ id }) => item.translations[id]),
      }),
    }, "Concept opgeslagen. Een bestaande publicatie is niet gewijzigd.", item.id);
  }

  async function statusAction(item: FaqItem, action: "publish" | "unpublish" | "hide") {
    const copy = action === "publish" ? "FAQ gepubliceerd." : action === "hide" ? "FAQ verborgen." : "Publicatie teruggezet naar concept.";
    await mutate(`${endpoint}/${item.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedRevision: faqSet.revision, itemVersion: item.version, idempotencyKey: crypto.randomUUID() }),
    }, copy);
  }

  async function removeItem(item: FaqItem) {
    if (!window.confirm("Deze FAQ verwijderen? De live publicatie verdwijnt na bevestiging.")) return;
    await mutate(`${endpoint}/${item.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: faqSet.revision, itemVersion: item.version, idempotencyKey: crypto.randomUUID() }),
    }, "FAQ verwijderd.");
  }

  async function reorder(nextItems: FaqItem[]) {
    setFaqSet((current) => ({ ...current, items: nextItems }));
    await mutate(`${endpoint}/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedRevision: faqSet.revision, idempotencyKey: crypto.randomUUID(), itemIds: nextItems.map((item) => item.id) }),
    }, "Volgorde opgeslagen.");
  }

  function move(itemId: string, delta: -1 | 1) {
    const index = faqSet.items.findIndex((item) => item.id === itemId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= faqSet.items.length) return;
    const next = [...faqSet.items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    void reorder(next);
  }

  function dropBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return setDraggedId(null);
    const source = faqSet.items.find((item) => item.id === draggedId);
    if (!source) return setDraggedId(null);
    const without = faqSet.items.filter((item) => item.id !== draggedId);
    const targetIndex = without.findIndex((item) => item.id === targetId);
    without.splice(targetIndex, 0, source);
    setDraggedId(null);
    void reorder(without);
  }

  const groupedCount = useMemo(() => placements.map((placement) => ({
    ...placement,
    count: faqSet.items.filter((item) => item.placement === placement.id).length,
  })), [faqSet.items]);

  if (phase === "loading") {
    return <div className="flex min-h-40 items-center justify-center text-muted"><LoadingIndicator label="FAQ laden…" showLabel /></div>;
  }

  return (
    <section aria-labelledby="faq-editor-title" aria-busy={phase === "saving"}>
      <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="faq-editor-title" className="text-heading-md text-text">Veelgestelde vragen</h2>
            <p className="mt-1 max-w-3xl text-body-sm leading-relaxed text-muted">
              Schrijf alle inhoud zelf. Alleen gepubliceerde vragen met een complete vertaling worden in die taal getoond.
            </p>
          </div>
          <button type="button" onClick={() => void addItem()} disabled={phase === "saving" || activeCount >= 50 || dirtyItemIds.size > 0} className={`${actionClass} border-accent bg-accent text-contrast`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Vraag toevoegen
          </button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {groupedCount.map((placement) => (
            <div key={placement.id} className="rounded-button border border-border bg-background p-3">
              <dt className="text-xs font-semibold text-muted">{placement.label}</dt>
              <dd className="mt-1 font-heading text-lg font-bold text-text">{placement.count}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 min-h-6" aria-live="polite">
          {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
          {!error && message ? <p className="text-body-sm font-semibold text-green-700">{message}</p> : null}
        </div>
      </div>

      {faqSet.items.length === 0 ? (
        <div className="mt-5 rounded-panel border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-heading font-bold text-text">Nog geen veelgestelde vragen</p>
          <p className="mt-2 text-body-sm text-muted">Voeg een concept toe. Er verschijnt pas iets in de webshop nadat je publiceert.</p>
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {faqSet.items.map((item, index) => {
            const activeLocale = localeByItem[item.id] ?? "nl";
            const translation = item.translations[activeLocale];
            return (
              <li
                key={item.id}
                draggable={dirtyItemIds.size === 0 && phase !== "saving"}
                onDragStart={() => setDraggedId(item.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropBefore(item.id)}
                className={`rounded-panel border bg-surface shadow-card ${draggedId === item.id ? "border-accent opacity-70" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 sm:px-5">
                  <span className="inline-flex min-h-11 cursor-grab items-center gap-2 pr-2 text-body-sm font-bold text-muted" title="Sleep om te sorteren">
                    <GripVertical className="h-5 w-5" aria-hidden="true" /> {index + 1}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "PUBLISHED" ? "bg-green-100 text-green-800" : item.status === "HIDDEN" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-900"}`}>
                    {statusLabels[item.status]}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button type="button" onClick={() => move(item.id, -1)} disabled={phase === "saving" || dirtyItemIds.size > 0 || index === 0} aria-label="Vraag omhoog" className={actionClass}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(item.id, 1)} disabled={phase === "saving" || dirtyItemIds.size > 0 || index === faqSet.items.length - 1} aria-label="Vraag omlaag" className={actionClass}><ArrowDown className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <label className="block text-body-sm font-semibold text-text">
                    Weergaveplek
                    <select value={item.placement} onChange={(event) => updateItem(item.id, (current) => ({ ...current, placement: event.target.value as FaqPlacement }))} className={inputClass}>
                      {placements.map((placement) => <option key={placement.id} value={placement.id}>{placement.label}</option>)}
                    </select>
                  </label>

                  <div className="mt-5 border-b border-border" role="tablist" aria-label="FAQ-taal">
                    <div className="flex gap-1 overflow-x-auto">
                      {locales.map((locale) => (
                        <button
                          key={locale.id}
                          id={faqLocaleTabId(item.id, locale.id)}
                          type="button"
                          role="tab"
                          aria-selected={activeLocale === locale.id}
                          aria-controls={faqLocalePanelId(item.id)}
                          tabIndex={activeLocale === locale.id ? 0 : -1}
                          onClick={() => selectLocale(item.id, locale.id)}
                          onKeyDown={(event) => navigateLocaleTabs(event, item.id, locale.id)}
                          className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-body-sm font-bold ${activeLocale === locale.id ? "border-accent text-text" : "border-transparent text-muted"}`}
                        >
                          {locale.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    id={faqLocalePanelId(item.id)}
                    role="tabpanel"
                    aria-labelledby={faqLocaleTabId(item.id, activeLocale)}
                    className="mt-4 grid gap-4"
                  >
                    <label className="block text-body-sm font-semibold text-text">
                      Vraag ({activeLocale.toUpperCase()})
                      <input
                        value={translation.question}
                        maxLength={240}
                        onChange={(event) => updateItem(item.id, (current) => ({ ...current, translations: { ...current.translations, [activeLocale]: { ...translation, question: event.target.value } } }))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-body-sm font-semibold text-text" htmlFor={`faq-answer-${item.id}-${activeLocale}`}>Antwoord ({activeLocale.toUpperCase()})</label>
                    <FaqRichTextEditor
                      id={`faq-answer-${item.id}-${activeLocale}`}
                      label={`Antwoord ${activeLocale.toUpperCase()}`}
                      value={translation.answerHtml}
                      onChange={(answerHtml) => updateItem(item.id, (current) => ({ ...current, translations: { ...current.translations, [activeLocale]: { ...translation, answerHtml } } }))}
                    />
                    <label className="block text-body-sm font-semibold text-text">
                      Alttekst of medialabel ({activeLocale.toUpperCase()})
                      <input
                      value={translation.mediaLabel}
                        maxLength={240}
                        onChange={(event) => updateItem(item.id, (current) => ({ ...current, translations: { ...current.translations, [activeLocale]: { ...translation, mediaLabel: event.target.value } } }))}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  {dirtyItemIds.has(item.id) ? (
                    <p className="mt-4 text-body-sm font-semibold text-amber-800" role="status">
                      Sla dit concept eerst op voordat je de status, media of volgorde wijzigt.
                    </p>
                  ) : null}

                  <FaqMediaControls endpoint={endpoint} faqSet={faqSet} item={item} disabled={phase === "saving" || dirtyItemIds.has(item.id)} mutate={mutate} />

                  <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
                    <button type="button" onClick={() => void saveItem(item)} disabled={phase === "saving"} className={actionClass}><Save className="h-4 w-4" />Concept opslaan</button>
                    <button type="button" onClick={() => void statusAction(item, "publish")} disabled={phase === "saving" || dirtyItemIds.has(item.id)} className={`${actionClass} border-green-300 text-green-800`}><Send className="h-4 w-4" />Publiceren</button>
                    {item.status === "PUBLISHED" ? <button type="button" onClick={() => void statusAction(item, "unpublish")} disabled={phase === "saving" || dirtyItemIds.has(item.id)} className={actionClass}><Undo2 className="h-4 w-4" />Depubliceren</button> : null}
                    <button type="button" onClick={() => void statusAction(item, "hide")} disabled={phase === "saving" || dirtyItemIds.has(item.id)} className={actionClass}><EyeOff className="h-4 w-4" />Verbergen</button>
                    <button type="button" onClick={() => void removeItem(item)} disabled={phase === "saving" || dirtyItemIds.has(item.id)} className={`${actionClass} ml-auto border-red-200 text-red-700`}><Trash2 className="h-4 w-4" />Verwijderen</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function FaqMediaControls({
  endpoint,
  faqSet,
  item,
  disabled,
  mutate,
}: {
  endpoint: string;
  faqSet: FaqSet;
  item: FaqItem;
  disabled: boolean;
  mutate: (url: string, init: RequestInit, success: string, committedItemId?: string) => Promise<boolean>;
}) {
  const [type, setType] = useState<FaqMediaType>(item.media?.type ?? "IMAGE");

  async function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("type", type);
    form.set("expectedRevision", String(faqSet.revision));
    form.set("itemVersion", String(item.version));
    form.set("idempotencyKey", crypto.randomUUID());
    await mutate(`${endpoint}/${item.id}/media`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: form }, "Media veilig opgeslagen bij het concept.");
  }

  return (
    <fieldset className="mt-5 rounded-button border border-border bg-background p-4">
      <legend className="px-1 text-body-sm font-bold text-text">Optionele media</legend>
      {item.media ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-body-sm text-text">{item.media.originalFilename ?? "Media-item"} · {item.media.type.toLowerCase()}</p>
          <button type="button" disabled={disabled} onClick={() => void mutate(`${endpoint}/${item.id}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: faqSet.revision, itemVersion: item.version, idempotencyKey: crypto.randomUUID() }) }, "Media verwijderd.")} className={`${actionClass} border-red-200 text-red-700`}><Trash2 className="h-4 w-4" />Media verwijderen</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-end">
          <label className="text-body-sm font-semibold text-text">
            Mediatype
            <select value={type} onChange={(event) => setType(event.target.value as FaqMediaType)} className={inputClass}>
              <option value="IMAGE">Afbeelding</option>
              <option value="INSTRUCTION">Instructie</option>
              <option value="INFOGRAPHIC">Infographic</option>
            </select>
          </label>
          <label className={`${actionClass} cursor-pointer border-accent`}>
            <Upload className="h-4 w-4" /> Bestand kiezen
            <input type="file" className="sr-only" disabled={disabled} accept={type === "IMAGE" ? "image/jpeg,image/png,image/webp,image/avif" : type === "INFOGRAPHIC" ? "image/jpeg,image/png,image/webp,image/avif,application/pdf" : "image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4,video/webm"} onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
        </div>
      )}
    </fieldset>
  );
}
