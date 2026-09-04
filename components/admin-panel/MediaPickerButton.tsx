"use client";

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";

type MediaOption = { id: string; url: string; originalFilename: string };

export function MediaPickerButton({
  onSelect,
  label = "Kies uit mediabibliotheek",
  className = "inline-flex min-h-9 items-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold",
}: {
  onSelect: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MediaOption[]>([]);

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/media");
      const body = (await response.json().catch(() => null)) as { assets?: MediaOption[] } | null;
      setOptions(body?.assets ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openPicker} className={className}>
        <ImageIcon size={14} />
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Kies media">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-panel bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-heading-md">Mediabibliotheek</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Sluiten" className="flex h-9 w-9 items-center justify-center rounded-button border border-border">
                <X size={16} />
              </button>
            </div>
            {loading ? (
              <p className="mt-4 text-body-sm text-muted">Laden…</p>
            ) : options.length === 0 ? (
              <p className="mt-4 text-body-sm text-muted">Nog geen media geüpload. Ga naar Marketing → Mediabibliotheek om afbeeldingen toe te voegen.</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {options.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      onSelect(asset.url);
                      setOpen(false);
                    }}
                    className="overflow-hidden rounded-panel border border-border"
                  >
                    <img src={asset.url} alt={asset.originalFilename} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
