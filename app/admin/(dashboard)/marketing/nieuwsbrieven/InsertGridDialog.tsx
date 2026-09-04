"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MediaPickerButton } from "@/components/admin-panel/MediaPickerButton";

export type GridItemDraft = {
  imageUrl: string | null;
  imageAlt: string;
  heading: string;
  body: string;
};

// Mirrors lib/aftersales/schema.ts's MAX_GRID_ITEMS / aftersalesGridItemSchema
// limits, which aren't exported from that module (it's a DB-bound schema, not
// a shared constants file) — kept in sync manually.
const MAX_GRID_ITEMS = 4;
const HEADING_MAX_LENGTH = 120;
const BODY_MAX_LENGTH = 400;
const ALT_MAX_LENGTH = 200;

const emptyItem = (): GridItemDraft => ({ imageUrl: null, imageAlt: "", heading: "", body: "" });

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (items: GridItemDraft[]) => void;
};

export function InsertGridDialog({ open, onClose, onInsert }: Props) {
  const [items, setItems] = useState<GridItemDraft[]>([emptyItem()]);

  if (!open) return null;

  function updateItem(index: number, patch: Partial<GridItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => (current.length >= MAX_GRID_ITEMS ? current : [...current, emptyItem()]));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function close() {
    setItems([emptyItem()]);
    onClose();
  }

  function confirm() {
    onInsert(items);
    setItems([emptyItem()]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Grid invoegen">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-panel bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-heading-md">Grid invoegen</h2>
          <button type="button" onClick={close} aria-label="Sluiten" className="flex h-9 w-9 items-center justify-center rounded-button border border-border">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="font-heading text-body-sm font-semibold">Grid-items (max {MAX_GRID_ITEMS})</p>
          <button type="button" onClick={addItem} disabled={items.length >= MAX_GRID_ITEMS} className="inline-flex min-h-9 items-center gap-1 rounded-button border border-border bg-white px-3 text-xs font-semibold disabled:opacity-40">
            <Plus size={14} />
            Item toevoegen
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <div key={index} className="rounded-button border border-border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-12 w-16 rounded border border-border object-cover" />
                ) : (
                  <span className="text-xs text-muted">Geen afbeelding</span>
                )}
                <div className="flex items-center gap-2">
                  <MediaPickerButton
                    onSelect={(url) => updateItem(index, { imageUrl: url })}
                    label="Kies afbeelding"
                    className="text-xs font-semibold text-accent-hover"
                  />
                  <button type="button" onClick={() => removeItem(index)} className="text-xs font-semibold text-red-700">Verwijder</button>
                </div>
              </div>
              <input
                value={item.imageAlt}
                maxLength={ALT_MAX_LENGTH}
                onChange={(event) => updateItem(index, { imageAlt: event.target.value })}
                placeholder="Alt-tekst afbeelding"
                className="mt-2 min-h-9 w-full rounded-button border border-border bg-background px-2 text-body-sm"
              />
              <input
                value={item.heading}
                maxLength={HEADING_MAX_LENGTH}
                onChange={(event) => updateItem(index, { heading: event.target.value })}
                placeholder="Kop"
                className="mt-2 min-h-9 w-full rounded-button border border-border bg-background px-2 text-body-sm"
              />
              <textarea
                value={item.body}
                maxLength={BODY_MAX_LENGTH}
                rows={2}
                onChange={(event) => updateItem(index, { body: event.target.value })}
                placeholder="Tekst"
                className="mt-2 w-full rounded-button border border-border bg-background px-2 py-1 text-body-sm"
              />
            </div>
          ))}
          {items.length === 0 ? <p className="text-body-sm text-muted">Nog geen items. Voeg er een toe.</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Annuleren</button>
          <button type="button" onClick={confirm} className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button">Invoegen</button>
        </div>
      </div>
    </div>
  );
}
