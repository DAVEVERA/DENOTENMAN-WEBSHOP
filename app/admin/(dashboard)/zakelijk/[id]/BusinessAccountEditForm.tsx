"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessAccountStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "saved" | "error";

async function patchBusinessAccount(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/business-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorMessageFor(data?.error));
  }

  return response.json();
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "EMAIL_ALREADY_EXISTS":
      return "Dit e-mailadres is al in gebruik.";
    case "VALIDATION_ERROR":
      return "Controleer de ingevulde velden.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}

const STATUS_ACTIONS: { status: BusinessAccountStatus; label: string; confirm: string; className: string }[] = [
  {
    status: "APPROVED",
    label: "Goedkeuren",
    confirm: "Dit zakelijke account goedkeuren?",
    className:
      "border-accent bg-accent text-contrast hover:border-accent-hover hover:bg-accent-hover",
  },
  {
    status: "REJECTED",
    label: "Afwijzen",
    confirm: "Dit zakelijke account afwijzen?",
    className: "border-red-300 bg-red-50 text-red-700 hover:border-red-400",
  },
  {
    status: "SUSPENDED",
    label: "Schorsen",
    confirm: "Dit zakelijke account schorsen?",
    className: "border-violet-300 bg-violet-50 text-violet-800 hover:border-violet-400",
  },
  {
    status: "PENDING",
    label: "Terugzetten naar in afwachting",
    confirm: "Dit zakelijke account terugzetten naar 'in afwachting'?",
    className: "border-border bg-background text-text hover:border-border-hover",
  },
];

const PRICE_TIER_OPTIONS = ["standard", "brons", "zilver", "goud"] as const;

export function BusinessAccountEditForm({
  businessAccountId,
  currentStatus,
  currentPriceTier,
  initialNotes,
}: {
  businessAccountId: string;
  currentStatus: BusinessAccountStatus;
  currentPriceTier: string;
  initialNotes: string;
}) {
  const router = useRouter();

  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<BusinessAccountStatus | null>(null);

  const [priceTier, setPriceTier] = useState(currentPriceTier);
  const [priceTierState, setPriceTierState] = useState<SaveState>("idle");
  const [priceTierError, setPriceTierError] = useState<string | null>(null);

  const [notes, setNotes] = useState(initialNotes);
  const [notesState, setNotesState] = useState<SaveState>("idle");
  const [notesError, setNotesError] = useState<string | null>(null);

  async function handleStatusChange(status: BusinessAccountStatus, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;

    setPendingStatus(status);
    setStatusState("saving");
    setStatusError(null);

    try {
      await patchBusinessAccount(businessAccountId, { status });
      setStatusState("saved");
      router.refresh();
    } catch (error) {
      setStatusState("error");
      setStatusError(error instanceof Error ? error.message : "Onbekende fout");
    } finally {
      setPendingStatus(null);
    }
  }

  async function handlePriceTierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceTierState("saving");
    setPriceTierError(null);

    try {
      await patchBusinessAccount(businessAccountId, { priceTier });
      setPriceTierState("saved");
      router.refresh();
    } catch (error) {
      setPriceTierState("error");
      setPriceTierError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  async function handleNotesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotesState("saving");
    setNotesError(null);

    try {
      await patchBusinessAccount(businessAccountId, { notes: notes.trim().length > 0 ? notes.trim() : null });
      setNotesState("saved");
      router.refresh();
    } catch (error) {
      setNotesState("error");
      setNotesError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-heading-sm text-text">Status</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {STATUS_ACTIONS.filter((action) => action.status !== currentStatus).map((action) => (
            <button
              key={action.status}
              type="button"
              onClick={() => handleStatusChange(action.status, action.confirm)}
              disabled={statusState === "saving"}
              className={cn(
                "inline-flex items-center justify-center rounded-button border px-4 py-2 font-heading text-body-sm font-semibold transition-colors duration-hover-fast disabled:cursor-not-allowed disabled:opacity-50",
                action.className
              )}
            >
              {statusState === "saving" && pendingStatus === action.status ? "Bezig…" : action.label}
            </button>
          ))}
          {statusState === "error" && (
            <span className="text-body-sm text-red-600">{statusError}</span>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading text-heading-sm text-text">Prijstier</h2>
        <form onSubmit={handlePriceTierSubmit} className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={priceTier}
            onChange={(event) => {
              setPriceTier(event.target.value);
              setPriceTierState("idle");
            }}
            className="rounded-button border border-border bg-surface px-3 py-2 text-body-md text-text focus:border-accent focus:outline-none"
          >
            {[priceTier, ...PRICE_TIER_OPTIONS.filter((tier) => tier !== priceTier)].map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={priceTierState === "saving" || priceTier === currentPriceTier}
            className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {priceTierState === "saving" ? "Opslaan…" : "Opslaan"}
          </button>
          {priceTierState === "saved" && <span className="text-body-sm text-green-700">Opgeslagen</span>}
          {priceTierState === "error" && <span className="text-body-sm text-red-600">{priceTierError}</span>}
        </form>
      </div>

      <div>
        <h2 className="font-heading text-heading-sm text-text">Notities</h2>
        <form onSubmit={handleNotesSubmit} className="mt-3 space-y-3">
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesState("idle");
            }}
            rows={4}
            placeholder="Interne notities over dit zakelijke account…"
            className="w-full rounded-button border border-border bg-surface px-3 py-2 text-body-md text-text focus:border-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={notesState === "saving" || notes === initialNotes}
              className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {notesState === "saving" ? "Opslaan…" : "Notities opslaan"}
            </button>
            {notesState === "saved" && <span className="text-body-sm text-green-700">Opgeslagen</span>}
            {notesState === "error" && <span className="text-body-sm text-red-600">{notesError}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
