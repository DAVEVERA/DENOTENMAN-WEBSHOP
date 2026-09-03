"use client";

import { useCallback, useRef, useState, useTransition } from "react";

export type MediaAssetDto = {
  id: string;
  url: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  altText: string | null;
  uploadedByName: string | null;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibraryClient({ initialAssets, initialCursor }: { initialAssets: MediaAssetDto[]; initialCursor: string | null }) {
  const [assets, setAssets] = useState(initialAssets);
  const [cursor, setCursor] = useState(initialCursor);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isLoadingMore, startLoadMore] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadError(null);
    startUpload(async () => {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        try {
          const response = await fetch("/api/admin/media", { method: "POST", body: form });
          const body = await response.json().catch(() => null);
          if (!response.ok || !body?.asset) {
            setUploadError(body?.message ?? `Uploaden van "${file.name}" is mislukt.`);
            continue;
          }
          setAssets((prev) => [body.asset as MediaAssetDto, ...prev]);
        } catch {
          setUploadError(`Uploaden van "${file.name}" is mislukt.`);
        }
      }
    });
  }, []);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    startLoadMore(async () => {
      const response = await fetch(`/api/admin/media?cursor=${encodeURIComponent(cursor)}`);
      const body = await response.json().catch(() => null);
      if (response.ok && body) {
        setAssets((prev) => [...prev, ...(body.assets as MediaAssetDto[])]);
        setCursor(body.nextCursor);
      }
    });
  }, [cursor]);

  const deleteAsset = useCallback(async (id: string) => {
    if (!window.confirm("Deze afbeelding definitief verwijderen uit de mediabibliotheek?")) return;
    const response = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    if (response.ok) setAssets((prev) => prev.filter((asset) => asset.id !== id));
  }, []);

  const copyUrl = useCallback(async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // Clipboard API unavailable — user can still select the URL text manually.
    }
  }, []);

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          uploadFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed p-6 text-center transition-colors duration-hover-fast ${
          isDragging ? "border-accent bg-accent/5" : "border-border bg-surface"
        }`}
      >
        <p className="font-heading text-body-md font-semibold text-text">
          {isUploading ? "Bezig met uploaden…" : "Sleep afbeeldingen hierheen of klik om te bladeren"}
        </p>
        <p className="text-body-sm text-muted">JPG, PNG, WebP of AVIF, maximaal 8 MB per bestand</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploadError ? <p className="mt-3 text-body-sm text-red-700">{uploadError}</p> : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {assets.map((asset) => (
          <div key={asset.id} className="group relative overflow-hidden rounded-panel border border-border bg-surface">
            <img src={asset.url} alt={asset.altText ?? asset.originalFilename} className="aspect-square w-full object-cover" loading="lazy" />
            <div className="p-2">
              <p className="truncate text-xs font-semibold text-text" title={asset.originalFilename}>{asset.originalFilename}</p>
              <p className="text-xs text-muted">{formatBytes(asset.sizeBytes)}</p>
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/50 to-transparent p-1.5 opacity-0 transition-opacity duration-hover-fast group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => copyUrl(asset.id, asset.url)}
                className="min-h-8 rounded-button bg-white/90 px-2 text-xs font-semibold text-text"
              >
                {copiedId === asset.id ? "Gekopieerd" : "URL"}
              </button>
              <button
                type="button"
                onClick={() => deleteAsset(asset.id)}
                className="min-h-8 rounded-button bg-white/90 px-2 text-xs font-semibold text-red-700"
              >
                Verwijder
              </button>
            </div>
          </div>
        ))}
        {assets.length === 0 ? (
          <p className="col-span-full py-6 text-center text-body-sm text-muted">Nog geen media geüpload.</p>
        ) : null}
      </div>

      {cursor ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="min-h-11 rounded-button border border-border bg-surface px-4 text-body-sm font-semibold text-text disabled:opacity-60"
          >
            {isLoadingMore ? "Laden…" : "Meer laden"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
