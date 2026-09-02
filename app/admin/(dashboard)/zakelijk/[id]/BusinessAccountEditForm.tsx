"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessAccountStatus, BusinessVatRegime } from "@prisma/client";
import { cn } from "@/lib/cn";
import { resolveVat, type BusinessVatCountry } from "@/lib/business-vat";

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

export function BusinessAccountEditForm({
  businessAccountId,
  currentStatus,
  initialNotes,
  currentVatNumber,
  currentKvkNumber,
  currentCountry,
  currentVatRegime,
  currentVatRatePercent,
  currentPeppolParticipantId,
}: {
  businessAccountId: string;
  currentStatus: BusinessAccountStatus;
  initialNotes: string;
  currentVatNumber: string;
  currentKvkNumber: string;
  currentCountry: BusinessVatCountry;
  currentVatRegime: BusinessVatRegime;
  currentVatRatePercent: number;
  currentPeppolParticipantId: string;
}) {
  const router = useRouter();

  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<BusinessAccountStatus | null>(null);

  const [notes, setNotes] = useState(initialNotes);
  const [notesState, setNotesState] = useState<SaveState>("idle");
  const [notesError, setNotesError] = useState<string | null>(null);

  const [vatNumber, setVatNumber] = useState(currentVatNumber);
  const [kvkNumber, setKvkNumber] = useState(currentKvkNumber);
  const [country, setCountry] = useState<BusinessVatCountry>(currentCountry);
  const [vatRegime, setVatRegime] = useState<BusinessVatRegime>(currentVatRegime);
  const [vatRatePercent, setVatRatePercent] = useState(currentVatRatePercent);
  const [peppolParticipantId, setPeppolParticipantId] = useState(currentPeppolParticipantId);
  const [taxState, setTaxState] = useState<SaveState>("idle");
  const [taxError, setTaxError] = useState<string | null>(null);
  const taxUnchanged =
    vatNumber === currentVatNumber &&
    kvkNumber === currentKvkNumber &&
    country === currentCountry &&
    vatRegime === currentVatRegime &&
    vatRatePercent === currentVatRatePercent &&
    peppolParticipantId === currentPeppolParticipantId;

  function handleCountryChange(next: BusinessVatCountry) {
    setCountry(next);
    const suggestion = resolveVat(next);
    setVatRegime(suggestion.regime);
    setVatRatePercent(suggestion.ratePercent);
    setTaxState("idle");
  }

  async function handleTaxSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaxState("saving");
    setTaxError(null);

    try {
      await patchBusinessAccount(businessAccountId, {
        vatNumber: vatNumber.trim().length > 0 ? vatNumber.trim() : null,
        kvkNumber: kvkNumber.trim().length > 0 ? kvkNumber.trim() : null,
        country,
        vatRegime,
        vatRatePercent,
        peppolParticipantId: peppolParticipantId.trim().length > 0 ? peppolParticipantId.trim() : null,
      });
      setTaxState("saved");
      router.refresh();
    } catch (error) {
      setTaxState("error");
      setTaxError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

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
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">Facturatie</p>
        <h2 className="mt-1 font-heading text-heading-sm text-text">Bedrijfsgegevens &amp; BTW</h2>
        <form onSubmit={handleTaxSubmit} className="mt-3 space-y-4 rounded-card bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-body-sm font-semibold text-text">
              BTW-nummer
              <input
                value={vatNumber}
                onChange={(event) => {
                  setVatNumber(event.target.value);
                  setTaxState("idle");
                }}
                placeholder="Bijv. NL123456789B01"
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              />
              <span className="mt-1 block text-xs font-normal text-muted">De klant kan dit ook zelf invullen in de zakelijke omgeving.</span>
            </label>
            <label className="block text-body-sm font-semibold text-text">
              KVK-nummer
              <input
                value={kvkNumber}
                onChange={(event) => {
                  setKvkNumber(event.target.value);
                  setTaxState("idle");
                }}
                placeholder="Bijv. 12345678"
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-body-sm font-semibold text-text">
              Land
              <select
                value={country}
                onChange={(event) => handleCountryChange(event.target.value as BusinessVatCountry)}
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              >
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <label className="block text-body-sm font-semibold text-text">
              BTW-percentage
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={vatRatePercent}
                onChange={(event) => {
                  setVatRatePercent(Number(event.target.value));
                  setTaxState("idle");
                }}
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-body-sm font-semibold text-text">
              BTW-regeling
              <select
                value={vatRegime}
                onChange={(event) => {
                  setVatRegime(event.target.value as BusinessVatRegime);
                  setTaxState("idle");
                }}
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              >
                <option value="STANDARD">Standaard</option>
                <option value="REVERSE_CHARGE">BTW verlegd</option>
              </select>
            </label>
          </div>

          {vatRegime === "REVERSE_CHARGE" ? (
            <p
              className={cn(
                "rounded-card p-3 text-body-sm",
                country === "BE" ? "bg-[#FFF9DA] text-accent-ink" : "bg-amber-50 text-amber-900"
              )}
            >
              {country === "BE" ? (
                <>
                  <strong>BTW verlegd</strong> — op facturen aan dit account wordt 0% BTW berekend. De klant
                  voldoet de BTW zelf via de eigen aangifte.
                </>
              ) : (
                <>BTW verlegd is ongebruikelijk voor een Nederlandse klant. Controleer of dit klopt.</>
              )}
            </p>
          ) : null}

          {country === "BE" ? (
            <label className="block text-body-sm font-semibold text-text">
              Peppol-ID (ondernemingsnummer of participant-ID)
              <input
                value={peppolParticipantId}
                onChange={(event) => {
                  setPeppolParticipantId(event.target.value);
                  setTaxState("idle");
                }}
                placeholder="Bijv. 0208:0123456789"
                className="mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                Nodig om facturen automatisch naar de Peppol-omgeving van deze klant te versturen. Leeg laten
                zolang dit nog niet bekend is.
              </span>
            </label>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={taxState === "saving" || taxUnchanged}
              className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {taxState === "saving" ? "Opslaan…" : "Opslaan"}
            </button>
            {taxState === "saved" && <span className="text-body-sm text-green-700">Opgeslagen</span>}
            {taxState === "error" && <span className="text-body-sm text-red-600">{taxError}</span>}
          </div>
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
