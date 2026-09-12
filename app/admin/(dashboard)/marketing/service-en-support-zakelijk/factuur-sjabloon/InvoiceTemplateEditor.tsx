"use client";

import { useState } from "react";
import type { InvoiceBlock, InvoiceCanvas, InvoiceColumn, InvoiceFreeBlockType, InvoiceRow, InvoiceTemplateBlockKey } from "@/lib/invoice-template-schema";
import { INVOICE_DATA_BLOCK_TYPES, INVOICE_FREE_BLOCK_TYPES, EDITABLE_TEXT_KEYS_BY_BLOCK, blockTextKey } from "@/lib/invoice-template-schema";

const BLOCK_LABELS: Record<string, string> = {
  header: "Kop", sellerAddress: "Verkoperadres", buyerAddress: "Klantadres", metadata: "Metadata",
  itemsTable: "Artikeltabel", totals: "Totalen", footer: "Footer",
  text: "Tekst", image: "Afbeelding", spacer: "Witruimte", divider: "Lijn", customHtml: "Custom HTML",
};

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultFreeBlock(type: InvoiceFreeBlockType): InvoiceBlock {
  const id = newId(type);
  switch (type) {
    case "text": return { id, type, font: "SANS", size: "STANDAARD", color: "#333333", align: "left", bold: false, italic: false };
    case "image": return { id, type, mediaUrl: null, alt: "", widthPt: 200, align: "left" };
    case "spacer": return { id, type, heightPt: 20, showDivider: false };
    case "divider": return { id, type, color: "#ddd6c8", thicknessPt: 1 };
    case "customHtml": return { id, type };
  }
}

async function saveCanvas(canvas: InvoiceCanvas): Promise<void> {
  await fetch("/api/admin/marketing/invoice-template/canvas", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(canvas),
  });
}

async function saveBlockText(key: string, value: string): Promise<void> {
  const blockId = key.split(":")[0];
  await fetch(`/api/admin/marketing/invoice-template/block-text/${blockId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="font-heading text-body-sm font-semibold">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-14 rounded-button border border-border bg-white" aria-label={label} />
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} maxLength={7} className="min-h-11 w-28 rounded-button border border-border bg-white px-2 text-body-sm" />
      </div>
    </div>
  );
}

function patchBlock(canvas: InvoiceCanvas, blockId: string, updater: (block: InvoiceBlock) => InvoiceBlock): InvoiceCanvas {
  return {
    rows: canvas.rows.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
      })),
    })),
  };
}

function isDataBlock(block: InvoiceBlock): block is Extract<InvoiceBlock, { backgroundColor: string; textColor: string }> {
  return (INVOICE_DATA_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export function InvoiceTemplateEditor({
  templateId,
  initialCanvas,
  initialBlockText,
}: {
  templateId: string;
  initialCanvas: InvoiceCanvas;
  initialBlockText: Record<string, string>;
}) {
  const [canvas, setCanvas] = useState<InvoiceCanvas>(initialCanvas);
  const [blockText, setBlockText] = useState<Record<string, string>>(initialBlockText);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const usedDataBlockTypes = new Set(
    canvas.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks.map((block) => block.type)))
  );

  function updateCanvas(updater: (canvas: InvoiceCanvas) => InvoiceCanvas) {
    setCanvas((current) => {
      const next = updater(current);
      void saveCanvas(next);
      return next;
    });
  }

  function updateBlockTextValue(key: string, value: string) {
    setBlockText((current) => ({ ...current, [key]: value }));
    void saveBlockText(key, value);
  }

  function addBlock(type: InvoiceFreeBlockType | (typeof INVOICE_DATA_BLOCK_TYPES)[number]) {
    const isDataType = (INVOICE_DATA_BLOCK_TYPES as readonly string[]).includes(type);
    const block: InvoiceBlock = isDataType
      ? { id: type, type: type as (typeof INVOICE_DATA_BLOCK_TYPES)[number], backgroundColor: "#ffffff", textColor: "#333333" }
      : defaultFreeBlock(type as InvoiceFreeBlockType);
    updateCanvas((current) => ({
      rows: [
        ...current.rows,
        { id: newId("row"), backgroundColor: "#ffffff", padding: 0, columns: [{ id: newId("col"), widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks: [block] }] },
      ],
    }));
  }

  function removeBlock(blockId: string) {
    updateCanvas((current) => ({
      rows: current.rows
        .map((row) => ({ ...row, columns: row.columns.map((column) => ({ ...column, blocks: column.blocks.filter((block) => block.id !== blockId) })) }))
        .filter((row) => row.columns.some((column) => column.blocks.length > 0)),
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    updateCanvas((current) => {
      const flatRowIndex = current.rows.findIndex((row) => row.columns.some((column) => column.blocks.some((block) => block.id === blockId)));
      if (flatRowIndex === -1) return current;
      const targetIndex = direction === "up" ? flatRowIndex - 1 : flatRowIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.rows.length) return current;
      const rows = [...current.rows];
      [rows[flatRowIndex], rows[targetIndex]] = [rows[targetIndex], rows[flatRowIndex]];
      return { rows };
    });
  }

  async function generatePreview() {
    setPreviewBusy(true);
    try {
      const response = await fetch("/api/admin/marketing/invoice-template/preview", { method: "POST" });
      const data = (await response.json()) as { pdfBase64: string };
      const bytes = Uint8Array.from(atob(data.pdfBase64), (char) => char.charCodeAt(0));
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function publish() {
    setPublishBusy(true);
    setPublishMessage(null);
    try {
      const response = await fetch("/api/admin/marketing/invoice-template/publish", { method: "POST" });
      setPublishMessage(response.ok ? "Gepubliceerd. Nieuwe facturen gebruiken dit sjabloon." : "Publiceren is niet gelukt.");
    } finally {
      setPublishBusy(false);
    }
  }

  const allBlocks = canvas.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks));
  const selectedBlock = allBlocks.find((block) => block.id === selectedBlockId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generatePreview} disabled={previewBusy} className="inline-flex min-h-11 items-center rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60">
          {previewBusy ? "Bezig…" : "Genereer voorbeeld"}
        </button>
        <button type="button" onClick={publish} disabled={publishBusy} className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">
          {publishBusy ? "Bezig…" : "Publiceren"}
        </button>
        {publishMessage ? <span className="text-body-sm font-semibold text-text">{publishMessage}</span> : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...INVOICE_DATA_BLOCK_TYPES, ...INVOICE_FREE_BLOCK_TYPES].map((type) => {
          const isDataType = (INVOICE_DATA_BLOCK_TYPES as readonly string[]).includes(type);
          const disabled = isDataType && usedDataBlockTypes.has(type);
          return (
            <button key={type} type="button" disabled={disabled} onClick={() => addBlock(type)} className="min-h-9 rounded-button border border-border bg-surface px-3 text-body-sm font-semibold text-text disabled:opacity-40">
              + {BLOCK_LABELS[type] ?? type}
            </button>
          );
        })}
      </div>

      <div className="mt-4 max-w-[595px] border border-border bg-white p-4">
        {allBlocks.length === 0 ? <p className="text-body-sm text-muted">Nog geen blokken. Voeg er een toe via de knoppen hierboven.</p> : null}
        {canvas.rows.map((row) =>
          row.columns.flatMap((column) =>
            column.blocks.map((block) => (
              <div
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
                className={`mb-2 flex items-center justify-between rounded-button border px-3 py-2 ${selectedBlockId === block.id ? "border-accent bg-accent/10" : "border-border"}`}
              >
                <span className="text-body-sm font-semibold text-text">{BLOCK_LABELS[block.type] ?? block.type}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, "up"); }} className="min-h-7 rounded-button border border-border px-2 text-xs">↑</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, "down"); }} className="min-h-7 rounded-button border border-border px-2 text-xs">↓</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }} className="min-h-7 rounded-button border border-border px-2 text-xs text-red-700">Verwijder</button>
                </span>
              </div>
            ))
          )
        )}
      </div>

      {selectedBlock ? (
        <div className="mt-4 max-w-[400px] rounded-card border border-border bg-surface p-4">
          <h2 className="font-heading text-body-sm font-bold text-text">{BLOCK_LABELS[selectedBlock.type] ?? selectedBlock.type} — instellingen</h2>

          {isDataBlock(selectedBlock) ? (
            <div className="mt-3 space-y-3">
              <ColorField label="Achtergrondkleur" value={selectedBlock.backgroundColor} onChange={(value) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, backgroundColor: value })))} />
              <ColorField label="Tekstkleur" value={selectedBlock.textColor} onChange={(value) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, textColor: value })))} />
              {(EDITABLE_TEXT_KEYS_BY_BLOCK[selectedBlock.type as InvoiceTemplateBlockKey] ?? []).map((field) => (
                <div key={field}>
                  <label className="font-heading text-body-sm font-semibold">{field}</label>
                  <input
                    type="text"
                    value={blockText[blockTextKey(selectedBlock.id, field)] ?? ""}
                    onChange={(event) => updateBlockTextValue(blockTextKey(selectedBlock.id, field), event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 text-body-sm"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {selectedBlock.type === "text" ? (
            <div className="mt-3 space-y-3">
              <ColorField label="Tekstkleur" value={selectedBlock.color} onChange={(value) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, color: value })))} />
              <textarea
                value={blockText[blockTextKey(selectedBlock.id)] ?? ""}
                onChange={(event) => updateBlockTextValue(blockTextKey(selectedBlock.id), event.target.value)}
                rows={4}
                className="w-full rounded-button border border-border bg-white p-2 text-body-sm"
              />
              <label className="flex items-center gap-2 text-body-sm">
                <input type="checkbox" checked={selectedBlock.bold} onChange={(event) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, bold: event.target.checked })))} />
                Vet
              </label>
            </div>
          ) : null}

          {selectedBlock.type === "image" ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className="font-heading text-body-sm font-semibold">Afbeelding-URL</label>
                <input
                  type="text"
                  value={selectedBlock.mediaUrl ?? ""}
                  onChange={(event) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, mediaUrl: event.target.value || null })))}
                  className="mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 text-body-sm"
                />
              </div>
              <div>
                <label className="font-heading text-body-sm font-semibold">Alt-tekst</label>
                <input
                  type="text"
                  value={selectedBlock.alt}
                  onChange={(event) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, alt: event.target.value })))}
                  className="mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 text-body-sm"
                />
              </div>
            </div>
          ) : null}

          {selectedBlock.type === "spacer" ? (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-body-sm">
                <input type="checkbox" checked={selectedBlock.showDivider} onChange={(event) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, showDivider: event.target.checked })))} />
                Toon scheidingslijn
              </label>
            </div>
          ) : null}

          {selectedBlock.type === "divider" ? (
            <div className="mt-3 space-y-3">
              <ColorField label="Kleur" value={selectedBlock.color} onChange={(value) => updateCanvas((current) => patchBlock(current, selectedBlock.id, (block) => ({ ...block, color: value })))} />
            </div>
          ) : null}

          {selectedBlock.type === "customHtml" ? (
            <div className="mt-3">
              <label className="font-heading text-body-sm font-semibold">HTML</label>
              <textarea
                value={blockText[blockTextKey(selectedBlock.id)] ?? ""}
                onChange={(event) => updateBlockTextValue(blockTextKey(selectedBlock.id), event.target.value)}
                rows={8}
                className="mt-1 w-full rounded-button border border-border bg-white p-2 font-mono text-body-sm"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
