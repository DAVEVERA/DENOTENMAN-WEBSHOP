"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "error";
type DiscountKind = "PERCENT" | "AMOUNT";
type DiscountFormInitial = {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  status: (typeof STATUS_OPTIONS)[number]["value"];
  percentOff: number | null;
  amountOffCents: number | null;
  minimumOrderCents: number;
  maximumDiscountCents: number | null;
  redemptionMode: "SINGLE_USE" | "MULTIPLE_USE";
  identityScope: "EMAIL" | "CUSTOMER" | "EMAIL_AND_CUSTOMER";
  maxUsesPerIdentity: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Concept" },
  { value: "ACTIVE", label: "Actief" },
  { value: "SCHEDULED", label: "Ingepland" },
  { value: "EXPIRED", label: "Verlopen" },
] as const;

const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

export function DiscountCreateForm({ initial }: { initial?: DiscountFormInitial }) {
  const router = useRouter();

  const [code, setCode] = useState(initial?.code ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>(initial?.status ?? "DRAFT");
  const [kind, setKind] = useState<DiscountKind>(initial?.amountOffCents !== null ? "AMOUNT" : "PERCENT");
  const [percentOff, setPercentOff] = useState(String(initial?.percentOff ?? 10));
  const [amountOffEuro, setAmountOffEuro] = useState(((initial?.amountOffCents ?? 500) / 100).toFixed(2));
  const [minimumOrderEuro, setMinimumOrderEuro] = useState(((initial?.minimumOrderCents ?? 0) / 100).toFixed(2));
  const [maximumDiscountEuro, setMaximumDiscountEuro] = useState(initial?.maximumDiscountCents === null || initial?.maximumDiscountCents === undefined ? "" : (initial.maximumDiscountCents / 100).toFixed(2));
  const [redemptionMode, setRedemptionMode] = useState<"SINGLE_USE" | "MULTIPLE_USE">(initial?.redemptionMode ?? "SINGLE_USE");
  const [identityScope, setIdentityScope] = useState<"EMAIL" | "CUSTOMER" | "EMAIL_AND_CUSTOMER">(initial?.identityScope ?? "EMAIL");
  const [maxUsesPerIdentity, setMaxUsesPerIdentity] = useState(initial?.maxUsesPerIdentity === null ? "" : String(initial?.maxUsesPerIdentity ?? 1));
  const [startsAt, setStartsAt] = useState(initial?.startsAt?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt?.slice(0, 10) ?? "");

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
    const minimumOrderValue = Math.round(Number(minimumOrderEuro.replace(",", ".")) * 100);
    const maximumDiscountValue = maximumDiscountEuro.trim()
      ? Math.round(Number(maximumDiscountEuro.replace(",", ".")) * 100)
      : null;
    const maxUsesValue = maxUsesPerIdentity.trim() ? Number(maxUsesPerIdentity) : null;

    if (!Number.isSafeInteger(minimumOrderValue) || minimumOrderValue < 0) {
      setState("error");
      setErrorMessage("Het minimale bestelbedrag is ongeldig.");
      return;
    }
    if (maximumDiscountValue !== null && (!Number.isSafeInteger(maximumDiscountValue) || maximumDiscountValue < 1)) {
      setState("error");
      setErrorMessage("De maximale korting moet leeg of minimaal € 0,01 zijn.");
      return;
    }
    if (redemptionMode === "MULTIPLE_USE" && maxUsesValue !== null && (!Number.isInteger(maxUsesValue) || maxUsesValue < 1)) {
      setState("error");
      setErrorMessage("Het maximale aantal keer per klant moet leeg of minimaal 1 zijn.");
      return;
    }

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
      const response = await fetch(initial ? `/api/admin/discounts/${initial.id}` : "/api/admin/discounts", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalizedCode,
          title: trimmedTitle,
          subtitle: subtitle.trim().length > 0 ? subtitle.trim() : null,
          status,
          percentOff: percentOffValue,
          amountOffCents: amountOffCentsValue,
          minimumOrderCents: minimumOrderValue,
          maximumDiscountCents: kind === "PERCENT" ? maximumDiscountValue : null,
          redemptionMode,
          identityScope,
          maxUsesPerIdentity: redemptionMode === "SINGLE_USE" ? 1 : maxUsesValue,
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
              readOnly={Boolean(initial)}
              required
              placeholder="ZOMER2026"
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 font-mono text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-body-sm text-muted">
              {initial ? "De code blijft vast zodat eerder gebruik correct gekoppeld blijft." : "Hoofdletters, cijfers en koppeltekens, 3-32 tekens. Moet uniek zijn."}
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

        <section className="rounded-card border border-border bg-background p-4">
          <h2 className="font-heading text-heading-sm text-text">Gebruik per klant</h2>
          <p className="mt-1 text-body-sm text-muted">Bestaande en nieuwe codes staan standaard op één keer per uniek e-mailadres.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="font-heading text-body-sm font-semibold text-text">
              Hoe vaak gebruiken
              <select value={redemptionMode} onChange={(event) => { const value = event.target.value as typeof redemptionMode; setRedemptionMode(value); if (value === "SINGLE_USE") setMaxUsesPerIdentity("1"); }} className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3">
                <option value="SINGLE_USE">Eén keer per klant</option>
                <option value="MULTIPLE_USE">Meerdere keren toestaan</option>
              </select>
            </label>
            <label className="font-heading text-body-sm font-semibold text-text">
              Unieke herkenning
              <select value={identityScope} onChange={(event) => setIdentityScope(event.target.value as typeof identityScope)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3">
                <option value="EMAIL">E-mailadres</option>
                <option value="CUSTOMER">Klant-ID</option>
                <option value="EMAIL_AND_CUSTOMER">E-mailadres en klant-ID</option>
              </select>
            </label>
            {redemptionMode === "MULTIPLE_USE" ? (
              <label className="font-heading text-body-sm font-semibold text-text sm:col-span-2">
                Maximum per klant (optioneel)
                <input type="number" min={1} step={1} value={maxUsesPerIdentity} onChange={(event) => setMaxUsesPerIdentity(event.target.value)} placeholder="Leeg is onbeperkt" className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3" />
              </label>
            ) : null}
          </div>
        </section>

        <section className="rounded-card border border-border bg-background p-4">
          <h2 className="font-heading text-heading-sm text-text">Bestelwaarde</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="font-heading text-body-sm font-semibold text-text">Minimaal bestelbedrag (€)<input type="number" min={0} step="0.01" value={minimumOrderEuro} onChange={(event) => setMinimumOrderEuro(event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3" /></label>
            {kind === "PERCENT" ? <label className="font-heading text-body-sm font-semibold text-text">Maximale korting (€)<input type="number" min={0.01} step="0.01" value={maximumDiscountEuro} onChange={(event) => setMaximumDiscountEuro(event.target.value)} placeholder="Leeg is geen maximum" className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3" /></label> : null}
          </div>
        </section>

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
          {state === "saving" ? "Opslaan…" : initial ? "Wijzigingen opslaan" : "Kortingscode aanmaken"}
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
    case "CODE_IMMUTABLE":
      return "De code zelf kan na aanmaken niet meer worden gewijzigd. Maak zo nodig een nieuwe code.";
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
