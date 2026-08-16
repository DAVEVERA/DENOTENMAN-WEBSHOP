"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SaveState = "idle" | "saving" | "error";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Concept" },
  { value: "ACTIVE", label: "Actief" },
  { value: "ENDED", label: "Beëindigd" },
] as const;

export function CampaignCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("DRAFT");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setState("error");
      setErrorMessage("Titel mag niet leeg zijn.");
      return;
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim().length > 0 ? description.trim() : null,
          status,
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

      router.push("/admin/marketing/acties");
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
          <label htmlFor="campaign-title" className="font-heading text-body-sm font-semibold text-text">
            Titel
          </label>
          <input
            id="campaign-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="campaign-description" className="font-heading text-body-sm font-semibold text-text">
            Beschrijving
          </label>
          <textarea
            id="campaign-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="campaign-status" className="font-heading text-body-sm font-semibold text-text">
              Status
            </label>
            <select
              id="campaign-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number]["value"])}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="campaign-starts-at" className="font-heading text-body-sm font-semibold text-text">
              Startdatum
            </label>
            <input
              id="campaign-starts-at"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="campaign-ends-at" className="font-heading text-body-sm font-semibold text-text">
              Einddatum
            </label>
            <input
              id="campaign-ends-at"
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : "Actie aanmaken"}
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
