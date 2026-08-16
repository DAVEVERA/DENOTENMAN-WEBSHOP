"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "error";

const PLACEMENT_OPTIONS = [
  { value: "HOMEPAGE", label: "Homepage" },
  { value: "CATEGORY", label: "Categorie" },
  { value: "PROMOTION", label: "Promotie" },
] as const;

export function BannerCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [placement, setPlacement] = useState<(typeof PLACEMENT_OPTIONS)[number]["value"]>("HOMEPAGE");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const response = await fetch("/api/admin/marketing/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          imageUrl: trimmedImageUrl,
          linkUrl: linkUrl.trim().length > 0 ? linkUrl.trim() : null,
          placement,
          isActive,
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

        <div>
          <label htmlFor="banner-image-url" className="font-heading text-body-sm font-semibold text-text">
            Afbeelding-URL of storage key
          </label>
          <input
            id="banner-image-url"
            type="text"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            required
            placeholder="https://… of banners/homepage-1.jpg"
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
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
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : "Banner aanmaken"}
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
