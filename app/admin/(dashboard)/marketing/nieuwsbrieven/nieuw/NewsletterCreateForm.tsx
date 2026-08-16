"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SaveState = "idle" | "saving" | "error";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Concept" },
  { value: "SCHEDULED", label: "Ingepland" },
  { value: "SENT", label: "Verzonden" },
] as const;

export function NewsletterCreateForm() {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("DRAFT");
  const [scheduledAt, setScheduledAt] = useState("");

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedSubject = subject.trim();
    const trimmedBody = bodyHtml.trim();
    if (trimmedSubject.length === 0) {
      setState("error");
      setErrorMessage("Onderwerp mag niet leeg zijn.");
      return;
    }
    if (trimmedBody.length === 0) {
      setState("error");
      setErrorMessage("Inhoud (HTML) mag niet leeg zijn.");
      return;
    }
    if (status === "SCHEDULED" && scheduledAt.length === 0) {
      setState("error");
      setErrorMessage("Stel een verzenddatum in voor een ingeplande nieuwsbrief.");
      return;
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/marketing/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: trimmedSubject,
          bodyHtml: trimmedBody,
          status,
          scheduledAt: scheduledAt.length > 0 ? new Date(scheduledAt).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setErrorMessage(errorMessageFor(data?.error));
        return;
      }

      router.push("/admin/marketing/nieuwsbrieven");
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
          <label htmlFor="newsletter-subject" className="font-heading text-body-sm font-semibold text-text">
            Onderwerp
          </label>
          <input
            id="newsletter-subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="newsletter-body" className="font-heading text-body-sm font-semibold text-text">
            Inhoud (HTML)
          </label>
          <textarea
            id="newsletter-body"
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            rows={12}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 font-mono text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-body-sm text-muted">
            Ruwe HTML — wordt niet automatisch verzonden. Verzendstatus wordt handmatig bijgewerkt.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="newsletter-status" className="font-heading text-body-sm font-semibold text-text">
              Status
            </label>
            <select
              id="newsletter-status"
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
            <label htmlFor="newsletter-scheduled-at" className="font-heading text-body-sm font-semibold text-text">
              Verzenddatum
            </label>
            <input
              id="newsletter-scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
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
          {state === "saving" ? "Opslaan…" : "Nieuwsbrief aanmaken"}
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
    case "INVALID_SCHEDULED_AT":
      return "Verzenddatum is ongeldig.";
    case "SCHEDULED_AT_REQUIRED":
      return "Stel een verzenddatum in voor een ingeplande nieuwsbrief.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}
