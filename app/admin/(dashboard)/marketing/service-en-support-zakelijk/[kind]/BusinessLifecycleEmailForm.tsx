"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessLifecycleEmailContentValue } from "@/lib/business-lifecycle-email-content";

type SaveState = "idle" | "saving" | "saved" | "error";

export function BusinessLifecycleEmailForm({
  kind,
  initialContent,
}: {
  kind: string;
  initialContent: BusinessLifecycleEmailContentValue;
}) {
  const router = useRouter();

  const [subject, setSubject] = useState(initialContent.subject);
  const [heading, setHeading] = useState(initialContent.heading);
  const [bodyText, setBodyText] = useState(initialContent.bodyText);
  const [buttonLabel, setButtonLabel] = useState(initialContent.buttonLabel);

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedSubject = subject.trim();
    const trimmedHeading = heading.trim();
    const trimmedBodyText = bodyText.trim();
    const trimmedButtonLabel = buttonLabel.trim();
    if (!trimmedSubject || !trimmedHeading || !trimmedBodyText || !trimmedButtonLabel) {
      setState("error");
      setErrorMessage("Alle velden zijn verplicht.");
      return;
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/marketing/business-lifecycle-emails/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: trimmedSubject,
          heading: trimmedHeading,
          bodyText: trimmedBodyText,
          buttonLabel: trimmedButtonLabel,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setErrorMessage(errorMessageFor(data?.error));
        return;
      }

      setState("saved");
      router.refresh();
    } catch {
      setState("error");
      setErrorMessage("Opslaan mislukt door een netwerkfout. Probeer het opnieuw.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-panel border border-border bg-surface p-6 shadow-card">
      <div className="grid grid-cols-1 gap-5">
        <div>
          <label htmlFor="lifecycle-email-subject" className="font-heading text-body-sm font-semibold text-text">
            Onderwerp
          </label>
          <input
            id="lifecycle-email-subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="lifecycle-email-heading" className="font-heading text-body-sm font-semibold text-text">
            Kop
          </label>
          <input
            id="lifecycle-email-heading"
            type="text"
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="lifecycle-email-body" className="font-heading text-body-sm font-semibold text-text">
            Introtekst
          </label>
          <textarea
            id="lifecycle-email-body"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            required
            rows={4}
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="lifecycle-email-button-label" className="font-heading text-body-sm font-semibold text-text">
            Knoptekst
          </label>
          <input
            id="lifecycle-email-button-label"
            type="text"
            value={buttonLabel}
            onChange={(event) => setButtonLabel(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : "Opslaan"}
        </button>

        {state === "saved" ? (
          <span className="text-body-sm font-semibold text-text">Opgeslagen.</span>
        ) : null}
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
    case "INVALID_KIND":
      return "Onbekend mailtype.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}
