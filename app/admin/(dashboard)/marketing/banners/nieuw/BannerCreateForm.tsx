"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { MediaPickerButton } from "@/components/admin-panel/MediaPickerButton";
import { CanvaPicker } from "@/components/admin-panel/canva/CanvaPicker";

type SaveState = "idle" | "saving" | "error";

const PLACEMENT_OPTIONS = [
  { value: "HOMEPAGE", label: "Homepage" },
  { value: "CATEGORY", label: "Categorie" },
  { value: "PROMOTION", label: "Promotie" },
  { value: "PAGE", label: "Specifieke pagina" },
] as const;

type InitialBanner = { id: string; title: string; imageUrl: string; linkUrl: string | null; placement: "HOMEPAGE" | "CATEGORY" | "PROMOTION" | "PAGE"; targetPath: string | null; slot: "TOP" | "BOTTOM"; isActive: boolean; isPublished: boolean; sortOrder: number; startsAt: string | null; endsAt: string | null };

export function BannerCreateForm({ initial }: { initial?: InitialBanner }) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [placement, setPlacement] = useState<(typeof PLACEMENT_OPTIONS)[number]["value"]>(initial?.placement ?? "HOMEPAGE");
  const [targetPath, setTargetPath] = useState(initial?.targetPath ?? "");
  const [slot, setSlot] = useState<"TOP" | "BOTTOM">(initial?.slot ?? "TOP");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [startsAt, setStartsAt] = useState(initial?.startsAt?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt?.slice(0, 10) ?? "");

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body: form });
      const body = await response.json().catch(() => null) as { asset?: { url: string }; message?: string } | null;
      if (!response.ok || !body?.asset?.url) throw new Error(body?.message || "Uploaden is mislukt.");
      setImageUrl(body.asset.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Uploaden is mislukt.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedImageUrl = imageUrl.trim();
    if (trimmedTitle.length === 0) {
      setState("error");
      setErrorMessage("Titel mag niet leeg zijn.");
      return;
    }
    if (trimmedImageUrl.length === 0) {
      setState("error");
      setErrorMessage("Afbeelding-URL mag niet leeg zijn.");
      return;
    }
    const parsedSortOrder = Number(sortOrder);
    if (!Number.isFinite(parsedSortOrder) || !Number.isInteger(parsedSortOrder)) {
      setState("error");
      setErrorMessage("Sortering moet een geheel getal zijn.");
      return;
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(initial ? `/api/admin/marketing/banners/${initial.id}` : "/api/admin/marketing/banners", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          imageUrl: trimmedImageUrl,
          linkUrl: linkUrl.trim().length > 0 ? linkUrl.trim() : null,
          placement,
          targetPath: placement === "PAGE" ? targetPath.trim() : null,
          slot,
          isActive,
          isPublished,
          sortOrder: parsedSortOrder,
          startsAt: startsAt.length > 0 ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt.length > 0 ? new Date(endsAt).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setErrorMessage(errorMessageFor(data?.error));
        return;
      }

      router.push("/admin/marketing/banners");
      router.refresh();
    } catch {
      setState("error");
      setErrorMessage("Opslaan mislukt door een netwerkfout. Probeer het opnieuw.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-panel border border-border bg-surface p-6 shadow-card"
    >
      <div className="grid grid-cols-1 gap-5">
        <div>
          <label htmlFor="banner-title" className="font-heading text-body-sm font-semibold text-text">
            Titel
          </label>
          <input
            id="banner-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {placement === "PAGE" ? <label className="font-heading text-body-sm font-semibold text-text">Pagina-pad
          <input required value={targetPath} onChange={(event) => setTargetPath(event.target.value)} placeholder="/nl/products/voorbeeld" className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md" />
          <span className="mt-1 block text-xs font-normal text-muted">Kopieer het pad van de gewenste webshoppagina, vanaf de eerste /.</span>
        </label> : null}
        <label className="font-heading text-body-sm font-semibold text-text">Positie op de pagina
          <select value={slot} onChange={(event) => setSlot(event.target.value as "TOP" | "BOTTOM")} className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md"><option value="TOP">Boven de pagina-inhoud</option><option value="BOTTOM">Onder de pagina-inhoud</option></select>
        </label>

        <div>
          <label htmlFor="banner-image-url" className="font-heading text-body-sm font-semibold text-text">
            Afbeelding-URL of storage key
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="banner-image-url"
              type="text"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              required
              placeholder="https://… of banners/homepage-1.jpg"
              className="min-w-0 flex-1 rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <MediaPickerButton onSelect={(url) => setImageUrl(url)} />
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-button border border-border bg-background px-3 text-xs font-semibold text-text">
              {uploadingImage ? "Uploaden…" : "Afbeelding uploaden"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploadingImage} onChange={(event) => { void uploadImage(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <CanvaPicker
              label="Maken of bewerken in Canva"
              defaultSize="storefront-banner"
              designTitle={title.trim() || "Banner De Notenman"}
              sourceImageUrl={imageUrl.startsWith("http") ? imageUrl : undefined}
              onSelect={(url) => setImageUrl(url)}
              editorWindow="popup"
            />
          </div>
          {uploadError ? <p role="alert" className="mt-2 text-body-sm font-semibold text-red-700">{uploadError}</p> : null}
          {imageUrl.trim() ? (
            <img src={imageUrl} alt="" className="mt-2 h-20 w-32 rounded-button border border-border object-cover" />
          ) : null}
        </div>

        <div>
          <label htmlFor="banner-link-url" className="font-heading text-body-sm font-semibold text-text">
            Link-URL
          </label>
          <input
            id="banner-link-url"
            type="text"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="/acties/zomer"
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="banner-placement" className="font-heading text-body-sm font-semibold text-text">
              Plaatsing
            </label>
            <select
              id="banner-placement"
              value={placement}
              onChange={(event) => setPlacement(event.target.value as (typeof PLACEMENT_OPTIONS)[number]["value"])}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PLACEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="banner-sort-order" className="font-heading text-body-sm font-semibold text-text">
              Sortering
            </label>
            <input
              id="banner-sort-order"
              type="number"
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              required
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="banner-starts-at" className="font-heading text-body-sm font-semibold text-text">
              Startdatum
            </label>
            <input
              id="banner-starts-at"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="banner-ends-at" className="font-heading text-body-sm font-semibold text-text">
              Einddatum
            </label>
            <input
              id="banner-ends-at"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <span className="font-heading text-body-sm font-semibold text-text">Status</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((current) => !current)}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-button border px-3 py-2 text-body-sm font-semibold transition-colors duration-hover-fast",
              isActive
                ? "border-accent bg-accent/10 text-accent-hover"
                : "border-border bg-background text-muted"
            )}
          >
            <span
              className={cn(
                "inline-flex h-5 w-9 items-center rounded-full border border-border-hover transition-colors duration-hover-fast",
                isActive ? "bg-accent" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full bg-surface shadow-card transition-transform duration-hover-fast",
                  isActive ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </span>
            {isActive ? "Actief" : "Inactief"}
          </button>
        </div>
        <label className="flex items-center gap-3 text-body-sm font-semibold text-text"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} className="h-5 w-5" />Publiceer op de webshop</label>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : initial ? "Wijzigingen opslaan" : "Banner aanmaken"}
        </button>

        {state === "error" ? (
          <span className="text-body-sm font-semibold text-red-700">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Controleer de ingevulde velden.";
    case "INVALID_STARTS_AT":
      return "Startdatum is ongeldig.";
    case "INVALID_ENDS_AT":
      return "Einddatum is ongeldig.";
    case "END_BEFORE_START":
      return "Einddatum kan niet vóór de startdatum liggen.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}
