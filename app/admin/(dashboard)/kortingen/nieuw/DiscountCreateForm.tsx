"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "error";
type DiscountKind = "PERCENT" | "AMOUNT";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Concept" },
  { value: "ACTIVE", label: "Actief" },
  { value: "SCHEDULED", label: "Ingepland" },
  { value: "EXPIRED", label: "Verlopen" },
] as const;

const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

export function DiscountCreateForm() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("DRAFT");
  const [kind, setKind] = useState<DiscountKind>("PERCENT");
  const [percentOff, setPercentOff] = useState("10");
  const [amountOffEuro, setAmountOffEuro] = useState("5.00");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    const trimmedTitle = title.trim();

    if (!CODE_PATTERN.test(normalizedCode)) {
      setState("error");
      setErrorMessage("Code mag alleen hoofdletters, cijfers en koppeltekens bevatten (3-32 tekens).");
      return;
    }
    if (trimmedTitle.length === 0) {
      setState("error");
      setErrorMessage("Titel mag niet leeg zijn.");
      return;
    }

    let percentOffValue: number | null = null;
    let amountOffCentsValue: number | null = null;

    if (kind === "PERCENT") {
      const parsedPercent = Number(percentOff);
      if (!Number.isFinite(parsedPercent) || !Number.isInteger(parsedPercent) || parsedPercent < 1 || parsedPercent > 100) {
        setState("error");
        setErrorMessage("Percentage korting moet een geheel getal tussen 1 en 100 zijn.");
        return;
      }
      percentOffValue = parsedPercent;
    } else {
      const parsedAmount = Number(amountOffEuro);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setState("error");
        setErrorMessage("Kortingsbedrag moet een positief bedrag zijn.");
        return;
      }
      amountOffCentsValue = Math.round(parsedAmount * 100);
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalizedCode,
          title: trimmedTitle,
          subtitle: subtitle.trim().length > 0 ? subtitle.trim() : null,
          status,
          percentOff: percentOffValue,
          amountOffCents: amountOffCentsValue,
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

      router.push("/admin/kortingen");
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="discount-code" className="font-heading text-body-sm font-semibold text-text">
              Code
            </label>
            <input
              id="discount-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
              placeholder="ZOMER2026"
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 font-mono text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-body-sm text-muted">
              Hoofdletters, cijfers en koppeltekens, 3-32 tekens. Moet uniek zijn.
            </p>
          </div>

          <div>
            <label htmlFor="discount-status" className="font-heading text-body-sm font-semibold text-text">
              Status
            </label>
            <select
              id="discount-status"
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
        </div>

        <div>
          <label htmlFor="discount-title" className="font-heading text-body-sm font-semibold text-text">
            Titel
          </label>
          <input
            id="discount-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="discount-subtitle" className="font-heading text-body-sm font-semibold text-text">
            Subtitel
          </label>
          <input
            id="discount-subtitle"
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <span className="font-heading text-body-sm font-semibold text-text">Kortingstype</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind("PERCENT")}
              className={cn(
                "rounded-button border px-3 py-2 text-body-sm font-semibold transition-colors duration-hover-fast",
                kind === "PERCENT"
                  ? "border-accent bg-accent/10 text-accent-hover"
                  : "border-border bg-background text-muted"
              )}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => setKind("AMOUNT")}
              className={cn(
                "rounded-button border px-3 py-2 text-body-sm font-semibold transition-colors duration-hover-fast",
                kind === "AMOUNT"
                  ? "border-accent bg-accent/10 text-accent-hover"
                  : "border-border bg-background text-muted"
              )}
            >
              Vast bedrag
            </button>
          </div>

          <div className="mt-3">
            {kind === "PERCENT" ? (
              <div>
                <label htmlFor="discount-percent" className="font-heading text-body-sm font-semibold text-text">
                  Percentage korting
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="discount-percent"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={percentOff}
                    onChange={(event) => setPercentOff(event.target.value)}
                    required
                    className="w-32 rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <span className="text-body-sm text-muted">%</span>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="discount-amount" className="font-heading text-body-sm font-semibold text-text">
                  Kortingsbedrag
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-body-sm text-muted">€</span>
                  <input
                    id="discount-amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={amountOffEuro}
                    onChange={(event) => setAmountOffEuro(event.target.value)}
                    required
                    className="w-32 rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="discount-starts-at" className="font-heading text-body-sm font-semibold text-text">
              Startdatum
            </label>
            <input
              id="discount-starts-at"
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="discount-ends-at" className="font-heading text-body-sm font-semibold text-text">
              Einddatum
            </label>
            <input
              id="discount-ends-at"
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
          {state === "saving" ? "Opslaan…" : "Kortingscode aanmaken"}
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
    case "INVALID_CODE_FORMAT":
      return "Code mag alleen hoofdletters, cijfers en koppeltekens bevatten (3-32 tekens).";
    case "CODE_ALREADY_EXISTS":
      return "Deze kortingscode bestaat al.";
    case "EXACTLY_ONE_DISCOUNT_TYPE_REQUIRED":
      return "Kies precies één kortingstype: percentage óf vast bedrag.";
    case "INVALID_PERCENT_OFF":
      return "Percentage korting moet tussen 1 en 100 liggen.";
    case "INVALID_AMOUNT_OFF_CENTS":
      return "Kortingsbedrag moet positief zijn.";
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
