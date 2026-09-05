"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type LogoResponse = { logoUrl?: string | null; error?: string };

export function BusinessLogoSettings({ initialLogoUrl }: { initialLogoUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [loading, setLoading] = useState(initialLogoUrl === undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (initialLogoUrl !== undefined) return;
    let active = true;
    void fetch("/api/business/account/logo", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("LOAD_FAILED");
        return response.json() as Promise<LogoResponse>;
      })
      .then((data) => {
        if (active) setLogoUrl(data.logoUrl ?? null);
      })
      .catch(() => {
        if (active) setMessage({ type: "error", text: "Het bedrijfslogo kon niet worden geladen." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [initialLogoUrl]);

  async function upload(file: File) {
    setMessage(null);
    if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setMessage({ type: "error", text: "Kies een PNG, JPG of WebP van maximaal 2 MB." });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/business/account/logo", { method: "POST", body: form });
      const data = await response.json().catch(() => null) as LogoResponse | null;
      if (!response.ok || !data?.logoUrl) throw new Error(data?.error ?? "UPLOAD_FAILED");
      setLogoUrl(data.logoUrl);
      setMessage({ type: "success", text: "Je bedrijfslogo is opgeslagen en verschijnt op nieuwe facturen." });
    } catch {
      setMessage({ type: "error", text: "Opslaan is niet gelukt. Controleer het bestand en probeer opnieuw." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/business/account/logo", { method: "DELETE" });
      if (!response.ok) throw new Error("DELETE_FAILED");
      setLogoUrl(null);
      setMessage({ type: "success", text: "Je bedrijfslogo is verwijderd. Bestaande facturen blijven ongewijzigd." });
    } catch {
      setMessage({ type: "error", text: "Verwijderen is niet gelukt. Probeer het opnieuw." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card" aria-labelledby="business-logo-heading">
      <h2 id="business-logo-heading" className="font-heading text-heading-sm text-text">Bedrijfslogo</h2>
      <p className="mt-1 text-body-sm text-muted">Dit logo staat op facturen die vanaf nu worden gemaakt. PNG, JPG of WebP, maximaal 2 MB.</p>

      <div className="mt-4 flex min-h-24 items-center justify-center rounded-card border border-dashed border-border bg-background p-3">
        {loading ? (
          <span className="text-body-sm text-muted">Logo laden…</span>
        ) : logoUrl ? (
          // The URL is an immutable, server-issued CDN URL, never raw user input.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Bedrijfslogo" className="max-h-20 max-w-full object-contain" />
        ) : (
          <span className="text-center text-body-sm text-muted">Nog geen logo ingesteld</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <ImageUp className="h-4 w-4" aria-hidden="true" />
          {busy ? "Bezig…" : logoUrl ? "Logo vervangen" : "Logo uploaden"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
        {logoUrl ? (
          <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text disabled:opacity-60">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Verwijderen
          </button>
        ) : null}
      </div>
      {message ? (
        <p role={message.type === "error" ? "alert" : "status"} className={`mt-3 text-body-sm font-semibold ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
