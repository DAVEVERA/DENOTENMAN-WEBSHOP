"use client";

/* eslint-disable @next/next/no-img-element -- imported designs live in the public media bucket. */

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { CanvaPicker } from "@/components/admin-panel/canva/CanvaPicker";

type Imported = { id: string; url: string; title: string; createdAt: string };

export function CanvaStudioGallery({ initial, connected }: { initial: Imported[]; connected: boolean }) {
  const [items, setItems] = useState(initial);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(url);
    window.setTimeout(() => setCopied(null), 1_500);
  }

  return (
    <section className="grid content-start gap-4 rounded-panel border border-border bg-surface p-5 shadow-card" aria-labelledby="canva-gallery">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="canva-gallery" className="text-heading-md text-text">Uit Canva geïmporteerd</h2>
        <CanvaPicker
          label={connected ? "Canva openen" : "Canva"}
          defaultSize="square"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast"
          onSelect={(_url, images) => setItems((current) => [
            ...images.map((image) => ({ id: image.id, url: image.url, title: "Zojuist geïmporteerd", createdAt: new Date().toISOString() })),
            ...current,
          ])}
        />
      </div>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="grid content-start gap-2 rounded-card border border-border bg-background p-2">
              <img src={item.url} alt="" className="aspect-square w-full rounded-button bg-surface object-contain" loading="lazy" />
              <p className="truncate text-xs font-semibold text-text" title={item.title}>{item.title}</p>
              <button type="button" onClick={() => void copy(item.url)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-button border border-border text-xs font-semibold">
                {copied === item.url ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied === item.url ? "Gekopieerd" : "Link kopiëren"}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-body-sm text-muted">Nog niets geïmporteerd. Open Canva om een design te maken of te kiezen.</p>}
    </section>
  );
}
