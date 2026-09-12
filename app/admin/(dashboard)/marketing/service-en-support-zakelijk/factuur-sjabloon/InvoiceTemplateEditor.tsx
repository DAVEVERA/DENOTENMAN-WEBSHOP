"use client";

import { useEffect, useRef, useState } from "react";
import type { InvoiceTemplateBlockKey, InvoiceTemplateBlockLayout } from "@/lib/invoice-template-schema";

const SCALE = 480 / 595;
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;

const BLOCK_LABELS: Record<InvoiceTemplateBlockKey, string> = {
  header: "Kop",
  sellerAddress: "Verkoperadres",
  buyerAddress: "Klantadres",
  metadata: "Metadata",
  itemsTable: "Artikeltabel",
  totals: "Totalen",
  footer: "Footer",
};

type DragState =
  | { mode: "move"; key: InvoiceTemplateBlockKey; startPointerX: number; startPointerY: number; startX: number; startY: number }
  | { mode: "resize"; key: InvoiceTemplateBlockKey; startPointerX: number; startPointerY: number; startWidth: number; startHeight: number };

async function patchBlock(key: InvoiceTemplateBlockKey, block: InvoiceTemplateBlockLayout): Promise<void> {
  await fetch(`/api/admin/marketing/invoice-template/blocks/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x: block.x, y: block.y, width: block.width, height: block.height, textOverrides: block.textOverrides }),
  });
}

export function InvoiceTemplateEditor({
  templateId,
  initialBlocks,
}: {
  templateId: string;
  initialBlocks: InvoiceTemplateBlockLayout[];
}) {
  const [blocks, setBlocks] = useState<InvoiceTemplateBlockLayout[]>(initialBlocks);
  const [selectedKey, setSelectedKey] = useState<InvoiceTemplateBlockKey | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const dragState = useRef<DragState | null>(null);

  function updateBlock(key: InvoiceTemplateBlockKey, updater: (block: InvoiceTemplateBlockLayout) => InvoiceTemplateBlockLayout) {
    setBlocks((current) => current.map((block) => (block.key === key ? updater(block) : block)));
  }

  function findBlock(key: InvoiceTemplateBlockKey): InvoiceTemplateBlockLayout {
    const block = blocks.find((candidate) => candidate.key === key);
    if (!block) throw new Error(`Missing block ${key}`);
    return block;
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragState.current;
      if (!drag) return;
      const deltaXPt = (event.clientX - drag.startPointerX) / SCALE;
      const deltaYPt = (event.clientY - drag.startPointerY) / SCALE;

      if (drag.mode === "move") {
        updateBlock(drag.key, (block) => ({
          ...block,
          x: Math.max(0, Math.min(PAGE_WIDTH_PT - block.width, drag.startX + deltaXPt)),
          y: Math.max(0, Math.min(PAGE_HEIGHT_PT - block.height, drag.startY + deltaYPt)),
        }));
      } else {
        updateBlock(drag.key, (block) => ({
          ...block,
          width: Math.max(20, Math.min(PAGE_WIDTH_PT - block.x, drag.startWidth + deltaXPt)),
          height: Math.max(20, Math.min(PAGE_HEIGHT_PT - block.y, drag.startHeight + deltaYPt)),
        }));
      }
    }

    function onPointerUp() {
      const drag = dragState.current;
      dragState.current = null;
      if (!drag) return;
      patchBlock(drag.key, findBlock(drag.key));
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  function startMove(key: InvoiceTemplateBlockKey, event: React.PointerEvent) {
    event.preventDefault();
    setSelectedKey(key);
    const block = findBlock(key);
    dragState.current = { mode: "move", key, startPointerX: event.clientX, startPointerY: event.clientY, startX: block.x, startY: block.y };
  }

  function startResize(key: InvoiceTemplateBlockKey, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const block = findBlock(key);
    dragState.current = { mode: "resize", key, startPointerX: event.clientX, startPointerY: event.clientY, startWidth: block.width, startHeight: block.height };
  }

  async function generatePreview() {
    setPreviewBusy(true);
    try {
      const response = await fetch("/api/admin/marketing/invoice-template/preview", { method: "POST" });
      const data = (await response.json()) as { pdfBase64: string };
      // Chrome blocks top-frame navigation to data: URLs, so window.open
      // needs an object URL (blob:) instead of a data:application/pdf URL.
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generatePreview}
          disabled={previewBusy}
          className="inline-flex min-h-11 items-center rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60"
        >
          {previewBusy ? "Bezig…" : "Genereer voorbeeld"}
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={publishBusy}
          className="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60"
        >
          {publishBusy ? "Bezig…" : "Publiceren"}
        </button>
        {publishMessage ? <span className="text-body-sm font-semibold text-text">{publishMessage}</span> : null}
      </div>

      <div
        className="relative mt-6 border border-border bg-white"
        style={{ width: `${PAGE_WIDTH_PT * SCALE}px`, height: `${PAGE_HEIGHT_PT * SCALE}px` }}
      >
        {blocks.map((block) => (
          <div
            key={block.key}
            onPointerDown={(event) => startMove(block.key, event)}
            className={`absolute cursor-move border ${selectedKey === block.key ? "border-accent" : "border-border"} bg-accent/10`}
            style={{
              left: block.x * SCALE,
              top: block.y * SCALE,
              width: block.width * SCALE,
              height: block.height * SCALE,
            }}
          >
            <span className="pointer-events-none select-none text-xs font-bold text-accent-ink">{BLOCK_LABELS[block.key]}</span>
            <div
              onPointerDown={(event) => startResize(block.key, event)}
              className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-accent"
            />
          </div>
        ))}
      </div>

      {selectedKey ? (
        <p className="mt-3 text-body-sm text-muted">Geselecteerd: {BLOCK_LABELS[selectedKey]}</p>
      ) : null}
    </div>
  );
}
