"use client";

import { Children, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BusinessAccountStatus, BusinessVatRegime } from "@prisma/client";
import { cn } from "@/lib/cn";
import { resolveVat, type BusinessVatCountry } from "@/lib/business-vat";

type SaveState = "idle" | "saving" | "saved" | "error";

type AddressFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

const STATUS_LABELS: Record<BusinessAccountStatus, string> = {
  PENDING: "In afwachting",
  APPROVED: "Goedgekeurd",
  REJECTED: "Afgewezen",
  SUSPENDED: "Geschorst",
};

const STATUS_BADGE_CLASSES: Record<BusinessAccountStatus, string> = {
  PENDING: "bg-border text-muted",
  APPROVED: "bg-accent/10 text-accent-hover",
  REJECTED: "bg-red-50 text-red-700",
  SUSPENDED: "bg-violet-50 text-violet-800",
};

const STATUS_ACTIONS: {
  status: BusinessAccountStatus;
  label: string;
  confirm: string;
  className: string;
}[] = [
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
    className:
      "border-violet-300 bg-violet-50 text-violet-800 hover:border-violet-400",
  },
  {
    status: "PENDING",
    label: "Terugzetten naar in afwachting",
    confirm: "Dit zakelijke account terugzetten naar 'in afwachting'?",
    className:
      "border-border bg-background text-text hover:border-border-hover",
  },
];

const inputClass =
  "mt-1 min-h-12 w-full rounded-button border border-border bg-surface px-3 text-body-md text-text focus:border-accent focus:outline-none";
const labelClass = "block text-body-sm font-semibold text-text";

async function patchBusinessAccount(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/business-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorMessageFor(data?.error));
  }

  return response.json();
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "EMAIL_ALREADY_EXISTS":
      return "Dit e-mailadres is al in gebruik.";
    case "CUSTOMER_NUMBER_ALREADY_EXISTS":
      return "Dit klantnummer is al in gebruik.";
    case "VALIDATION_ERROR":
      return "Controleer de ingevulde velden.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    case "ALREADY_DELETED":
      return "Dit account is al verwijderd.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}

function addressUnchanged(a: AddressFields, b: AddressFields): boolean {
  return (
    a.street === b.street &&
    a.houseNumber === b.houseNumber &&
    a.postalCode === b.postalCode &&
    a.city === b.city &&
    a.country === b.country
  );
}

function AddressFieldset({
  legend,
  values,
  onChange,
}: {
  legend: string;
  values: AddressFields;
  onChange: (next: AddressFields) => void;
}) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">{legend}</legend>
      <label className={cn(labelClass, "sm:col-span-2")}>
        Straat
        <input
          value={values.street}
          onChange={(event) =>
            onChange({ ...values, street: event.target.value })
          }
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Huisnummer
        <input
          value={values.houseNumber}
          onChange={(event) =>
            onChange({ ...values, houseNumber: event.target.value })
          }
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Postcode
        <input
          value={values.postalCode}
          onChange={(event) =>
            onChange({ ...values, postalCode: event.target.value })
          }
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Plaats
        <input
          value={values.city}
          onChange={(event) =>
            onChange({ ...values, city: event.target.value })
          }
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Land
        <input
          value={values.country}
          onChange={(event) =>
            onChange({ ...values, country: event.target.value })
          }
          placeholder="Bijv. Nederland"
          className={inputClass}
        />
      </label>
    </fieldset>
  );
}

function BusinessAccountSection({
  title,
  eyebrow,
  children,
  defaultOpen = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group overflow-hidden rounded-panel border border-border bg-surface shadow-card"
      open={defaultOpen}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-details-marker]:hidden sm:px-5">
        <span className="min-w-0">
          {eyebrow ? (
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
              {eyebrow}
            </span>
          ) : null}
          <span className="mt-0.5 block font-heading text-heading-sm text-text">
            {title}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-border px-4 py-5 sm:px-5">
        {Children.toArray(children)}
      </div>
    </details>
  );
}

export function BusinessAccountSections({
  businessAccountId,
  currentStatus,
  isDeleted,
  initialNotes,
  currentCompanyName,
  currentContactName,
  currentEmail,
  currentPhone,
  currentCustomerNumber,
  currentVatNumber,
  currentKvkNumber,
  currentCountry,
  currentVatRegime,
  currentVatRatePercent,
  currentPeppolParticipantId,
  currentShippingEnabled,
  currentBillingAddress,
  currentShippingAddress,
  contactCompanyOverview,
  deliveryOverview,
  invoices,
  personalInvitation,
  orderLists,
  events,
}: {
  businessAccountId: string;
  currentStatus: BusinessAccountStatus;
  isDeleted: boolean;
  initialNotes: string;
  currentCompanyName: string;
  currentContactName: string;
  currentEmail: string;
  currentPhone: string;
  currentCustomerNumber: string;
  currentVatNumber: string;
  currentKvkNumber: string;
  currentCountry: BusinessVatCountry;
  currentVatRegime: BusinessVatRegime;
  currentVatRatePercent: number;
  currentPeppolParticipantId: string;
  currentShippingEnabled: boolean;
  currentBillingAddress: AddressFields;
  currentShippingAddress: AddressFields;
  contactCompanyOverview: ReactNode;
  deliveryOverview: ReactNode;
  invoices: ReactNode;
  personalInvitation: ReactNode;
  orderLists: ReactNode;
  events: ReactNode;
}) {
  const router = useRouter();
  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] =
    useState<BusinessAccountStatus | null>(null);
  const [deleteState, setDeleteState] = useState<SaveState>("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [notesState, setNotesState] = useState<SaveState>("idle");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(currentCompanyName);
  const [contactName, setContactName] = useState(currentContactName);
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone);
  const [customerNumber, setCustomerNumber] = useState(currentCustomerNumber);
  const [profileState, setProfileState] = useState<SaveState>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [vatNumber, setVatNumber] = useState(currentVatNumber);
  const [kvkNumber, setKvkNumber] = useState(currentKvkNumber);
  const [country, setCountry] = useState<BusinessVatCountry>(currentCountry);
  const [vatRegime, setVatRegime] =
    useState<BusinessVatRegime>(currentVatRegime);
  const [vatRatePercent, setVatRatePercent] = useState(currentVatRatePercent);
  const [peppolParticipantId, setPeppolParticipantId] = useState(
    currentPeppolParticipantId,
  );
  const [taxState, setTaxState] = useState<SaveState>("idle");
  const [taxError, setTaxError] = useState<string | null>(null);
  const [shippingEnabled, setShippingEnabled] = useState(
    currentShippingEnabled,
  );
  const [shippingAddress, setShippingAddress] = useState(
    currentShippingAddress,
  );
  const [shippingState, setShippingState] = useState<SaveState>("idle");
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [billingAddress, setBillingAddress] = useState(currentBillingAddress);
  const [billingState, setBillingState] = useState<SaveState>("idle");
  const [billingError, setBillingError] = useState<string | null>(null);

  const profileUnchanged =
    companyName === currentCompanyName &&
    contactName === currentContactName &&
    email === currentEmail &&
    phone === currentPhone &&
    customerNumber === currentCustomerNumber;
  const taxUnchanged =
    vatNumber === currentVatNumber &&
    kvkNumber === currentKvkNumber &&
    country === currentCountry &&
    vatRegime === currentVatRegime &&
    vatRatePercent === currentVatRatePercent &&
    peppolParticipantId === currentPeppolParticipantId;
  const shippingUnchanged =
    shippingEnabled === currentShippingEnabled &&
    addressUnchanged(shippingAddress, currentShippingAddress);
  const billingUnchanged = addressUnchanged(
    billingAddress,
    currentBillingAddress,
  );

  function handleCountryChange(next: BusinessVatCountry) {
    setCountry(next);
    const suggestion = resolveVat(next);
    setVatRegime(suggestion.regime);
    setVatRatePercent(suggestion.ratePercent);
    setTaxState("idle");
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileState("saving");
    setProfileError(null);
    try {
      await patchBusinessAccount(businessAccountId, {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim().length > 0 ? phone.trim() : null,
        customerNumber:
          customerNumber.trim().length > 0 ? customerNumber.trim() : null,
      });
      setProfileState("saved");
      router.refresh();
    } catch (error) {
      setProfileState("error");
      setProfileError(
        error instanceof Error ? error.message : "Onbekende fout",
      );
    }
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
        peppolParticipantId:
          peppolParticipantId.trim().length > 0
            ? peppolParticipantId.trim()
            : null,
      });
      setTaxState("saved");
      router.refresh();
    } catch (error) {
      setTaxState("error");
      setTaxError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  async function handleShippingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShippingState("saving");
    setShippingError(null);
    try {
      await patchBusinessAccount(businessAccountId, {
        shippingEnabled,
        shippingStreet:
          shippingAddress.street.trim().length > 0
            ? shippingAddress.street.trim()
            : null,
        shippingHouseNumber:
          shippingAddress.houseNumber.trim().length > 0
            ? shippingAddress.houseNumber.trim()
            : null,
        shippingPostalCode:
          shippingAddress.postalCode.trim().length > 0
            ? shippingAddress.postalCode.trim()
            : null,
        shippingCity:
          shippingAddress.city.trim().length > 0
            ? shippingAddress.city.trim()
            : null,
        shippingCountry:
          shippingAddress.country.trim().length > 0
            ? shippingAddress.country.trim()
            : null,
      });
      setShippingState("saved");
      router.refresh();
    } catch (error) {
      setShippingState("error");
      setShippingError(
        error instanceof Error ? error.message : "Onbekende fout",
      );
    }
  }

  async function handleBillingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBillingState("saving");
    setBillingError(null);
    try {
      await patchBusinessAccount(businessAccountId, {
        billingStreet:
          billingAddress.street.trim().length > 0
            ? billingAddress.street.trim()
            : null,
        billingHouseNumber:
          billingAddress.houseNumber.trim().length > 0
            ? billingAddress.houseNumber.trim()
            : null,
        billingPostalCode:
          billingAddress.postalCode.trim().length > 0
            ? billingAddress.postalCode.trim()
            : null,
        billingCity:
          billingAddress.city.trim().length > 0
            ? billingAddress.city.trim()
            : null,
        billingCountry:
          billingAddress.country.trim().length > 0
            ? billingAddress.country.trim()
            : null,
      });
      setBillingState("saved");
      router.refresh();
    } catch (error) {
      setBillingState("error");
      setBillingError(
        error instanceof Error ? error.message : "Onbekende fout",
      );
    }
  }

  async function handleNotesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotesState("saving");
    setNotesError(null);
    try {
      await patchBusinessAccount(businessAccountId, {
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });
      setNotesState("saved");
      router.refresh();
    } catch (error) {
      setNotesState("error");
      setNotesError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  async function handleStatusChange(
    status: BusinessAccountStatus,
    confirmMessage: string,
  ) {
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

  async function handleDelete() {
    if (
      !window.confirm(
        `Weet je zeker dat je ${companyName} wilt verwijderen? Eerdere bestellingen en facturen blijven bewaard.`,
      )
    )
      return;
    setDeleteState("saving");
    setDeleteError(null);
    try {
      const response = await fetch(
        `/api/admin/business-accounts/${businessAccountId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorMessageFor(data?.error));
      }
      router.push("/admin/zakelijk");
      router.refresh();
    } catch (error) {
      setDeleteState("error");
      setDeleteError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  async function handleRestore() {
    setDeleteState("saving");
    setDeleteError(null);
    try {
      const response = await fetch(
        `/api/admin/business-accounts/${businessAccountId}/restore`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorMessageFor(data?.error));
      }
      setDeleteState("saved");
      router.refresh();
    } catch (error) {
      setDeleteState("error");
      setDeleteError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <BusinessAccountSection
        title="Klantprofiel"
        eyebrow="Klantprofiel"
        defaultOpen
      >
        <div key="customer-profile">{contactCompanyOverview}</div>
      </BusinessAccountSection>

      <BusinessAccountSection
        title="Contactgegevens & bedrijfsgegevens"
        eyebrow="Contact & bedrijf"
      >
        <h3 className="font-heading text-heading-sm text-text">
          Bedrijfsprofiel &amp; klantnummer
        </h3>
        <form
          onSubmit={handleProfileSubmit}
          className="mt-3 space-y-4 rounded-card bg-background p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Bedrijfsnaam
              <input
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  setProfileState("idle");
                }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Contactpersoon
              <input
                value={contactName}
                onChange={(event) => {
                  setContactName(event.target.value);
                  setProfileState("idle");
                }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setProfileState("idle");
                }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Telefoon
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setProfileState("idle");
                }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Klantnummer
              <input
                value={customerNumber}
                onChange={(event) => {
                  setCustomerNumber(event.target.value);
                  setProfileState("idle");
                }}
                placeholder="Bijv. K1042"
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={profileState === "saving" || profileUnchanged}
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileState === "saving" ? "Opslaan…" : "Opslaan"}
            </button>
            {profileState === "saved" && (
              <span className="text-body-sm text-green-700">Opgeslagen</span>
            )}
            {profileState === "error" && (
              <span className="text-body-sm text-red-600">{profileError}</span>
            )}
          </div>
        </form>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
            Facturatie
          </p>
          <h3 className="mt-1 font-heading text-heading-sm text-text">
            Bedrijfsgegevens &amp; BTW
          </h3>
          <form
            onSubmit={handleTaxSubmit}
            className="mt-3 space-y-4 rounded-card bg-background p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                BTW-nummer
                <input
                  value={vatNumber}
                  onChange={(event) => {
                    setVatNumber(event.target.value);
                    setTaxState("idle");
                  }}
                  placeholder="Bijv. NL123456789B01"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-muted">
                  De klant kan dit ook zelf invullen in de zakelijke omgeving.
                </span>
              </label>
              <label className={labelClass}>
                KVK-nummer
                <input
                  value={kvkNumber}
                  onChange={(event) => {
                    setKvkNumber(event.target.value);
                    setTaxState("idle");
                  }}
                  placeholder="Bijv. 12345678"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Land
                <select
                  value={country}
                  onChange={(event) =>
                    handleCountryChange(
                      event.target.value as BusinessVatCountry,
                    )
                  }
                  className={inputClass}
                >
                  <option value="NL">Nederland</option>
                  <option value="BE">België</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <label className={labelClass}>
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
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                BTW-regeling
                <select
                  value={vatRegime}
                  onChange={(event) => {
                    setVatRegime(event.target.value as BusinessVatRegime);
                    setTaxState("idle");
                  }}
                  className={inputClass}
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
                  country === "BE"
                    ? "bg-[#FFF9DA] text-accent-ink"
                    : "bg-amber-50 text-amber-900",
                )}
              >
                {country === "BE" ? (
                  <>
                    <strong>BTW verlegd</strong> — op facturen aan dit account
                    wordt 0% BTW berekend. De klant voldoet de BTW zelf via de
                    eigen aangifte.
                  </>
                ) : (
                  <>
                    BTW verlegd is ongebruikelijk voor een Nederlandse klant.
                    Controleer of dit klopt.
                  </>
                )}
              </p>
            ) : null}
            {country === "BE" ? (
              <label className={labelClass}>
                Peppol-ID (ondernemingsnummer of participant-ID)
                <input
                  value={peppolParticipantId}
                  onChange={(event) => {
                    setPeppolParticipantId(event.target.value);
                    setTaxState("idle");
                  }}
                  placeholder="Bijv. 0208:0123456789"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-muted">
                  Nodig om facturen automatisch naar de Peppol-omgeving van deze
                  klant te versturen. Leeg laten zolang dit nog niet bekend is.
                </span>
              </label>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={taxState === "saving" || taxUnchanged}
                className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {taxState === "saving" ? "Opslaan…" : "Opslaan"}
              </button>
              {taxState === "saved" && (
                <span className="text-body-sm text-green-700">Opgeslagen</span>
              )}
              {taxState === "error" && (
                <span className="text-body-sm text-red-600">{taxError}</span>
              )}
            </div>
          </form>
        </div>
      </BusinessAccountSection>

      <BusinessAccountSection title="Levering & adressen" eyebrow="Levering">
        <div key="delivery-overview">{deliveryOverview}</div>
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-heading text-heading-sm text-text">
              Verzendadres
            </h3>
            <button
              type="button"
              onClick={() => {
                setShippingEnabled((previous) => !previous);
                setShippingState("idle");
              }}
              aria-pressed={shippingEnabled}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-button border px-4 font-heading text-body-sm font-semibold transition-colors duration-hover-fast",
                shippingEnabled
                  ? "border-accent bg-accent text-contrast"
                  : "border-border bg-surface text-muted",
              )}
            >
              Verzending {shippingEnabled ? "aan" : "uit"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Staat dit uit, dan haalt de klant zijn bestelling op bij De Notenman
            op de markt. Zet dit pas aan zodra verzenden voor deze klant
            mogelijk is.
          </p>
          <form
            onSubmit={handleShippingSubmit}
            className="mt-3 space-y-4 rounded-card bg-background p-4"
          >
            <AddressFieldset
              legend="Verzendadres"
              values={shippingAddress}
              onChange={setShippingAddress}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={shippingState === "saving" || shippingUnchanged}
                className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shippingState === "saving" ? "Opslaan…" : "Opslaan"}
              </button>
              {shippingState === "saved" && (
                <span className="text-body-sm text-green-700">Opgeslagen</span>
              )}
              {shippingState === "error" && (
                <span className="text-body-sm text-red-600">
                  {shippingError}
                </span>
              )}
            </div>
          </form>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
            Facturatie
          </p>
          <h3 className="mt-1 font-heading text-heading-sm text-text">
            Factuuradres
          </h3>
          <form
            onSubmit={handleBillingSubmit}
            className="mt-3 space-y-4 rounded-card bg-background p-4"
          >
            <AddressFieldset
              legend="Factuuradres"
              values={billingAddress}
              onChange={setBillingAddress}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={billingState === "saving" || billingUnchanged}
                className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {billingState === "saving" ? "Opslaan…" : "Opslaan"}
              </button>
              {billingState === "saved" && (
                <span className="text-body-sm text-green-700">Opgeslagen</span>
              )}
              {billingState === "error" && (
                <span className="text-body-sm text-red-600">
                  {billingError}
                </span>
              )}
            </div>
          </form>
        </div>
      </BusinessAccountSection>

      <BusinessAccountSection title="Facturen" eyebrow="Facturatie">
        <div key="invoices">{invoices}</div>
      </BusinessAccountSection>

      <BusinessAccountSection title="Notities" eyebrow="Intern">
        <form onSubmit={handleNotesSubmit} className="space-y-3">
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
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {notesState === "saving" ? "Opslaan…" : "Notities opslaan"}
            </button>
            {notesState === "saved" && (
              <span className="text-body-sm text-green-700">Opgeslagen</span>
            )}
            {notesState === "error" && (
              <span className="text-body-sm text-red-600">{notesError}</span>
            )}
          </div>
        </form>
      </BusinessAccountSection>

      <BusinessAccountSection
        title="Persoonlijke uitnodiging"
        eyebrow="Klanttoegang"
      >
        <div key="personal-invitation">{personalInvitation}</div>
      </BusinessAccountSection>
      <BusinessAccountSection title="Bestellijsten" eyebrow="Samen bestellen">
        <div key="order-lists">{orderLists}</div>
      </BusinessAccountSection>
      <BusinessAccountSection title="Gebeurtenissen" eyebrow="Activiteit">
        <div key="events">{events}</div>
      </BusinessAccountSection>

      <BusinessAccountSection title="Status" eyebrow="Accountstatus">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-button px-3 py-1 text-body-sm font-semibold",
              STATUS_BADGE_CLASSES[currentStatus],
            )}
          >
            {STATUS_LABELS[currentStatus]}
          </span>
        </div>
        {isDeleted ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-red-300 bg-red-50 p-4">
            <p className="text-body-sm font-semibold text-red-700">
              Dit account is verwijderd en verborgen uit de lijst.
            </p>
            <button
              type="button"
              onClick={handleRestore}
              disabled={deleteState === "saving"}
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-red-400 bg-white px-4 font-heading text-body-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteState === "saving" ? "Bezig…" : "Herstellen"}
            </button>
          </div>
        ) : null}
        {deleteState === "error" && deleteError ? (
          <p className="mt-3 text-body-sm text-red-600">{deleteError}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {STATUS_ACTIONS.filter(
            (action) => action.status !== currentStatus,
          ).map((action) => (
            <button
              key={action.status}
              type="button"
              onClick={() => handleStatusChange(action.status, action.confirm)}
              disabled={statusState === "saving"}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-button border px-4 font-heading text-body-sm font-semibold transition-colors duration-hover-fast disabled:cursor-not-allowed disabled:opacity-50",
                action.className,
              )}
            >
              {statusState === "saving" && pendingStatus === action.status
                ? "Bezig…"
                : action.label}
            </button>
          ))}
          {statusState === "error" && (
            <span className="text-body-sm text-red-600">{statusError}</span>
          )}
        </div>
        {!isDeleted ? (
          <div className="mt-6 rounded-card border border-red-200 bg-red-50/50 p-4">
            <h3 className="font-heading text-heading-sm text-red-800">
              Verwijderen
            </h3>
            <p className="mt-1 text-body-sm text-red-700">
              Verbergt dit account uit de lijst. Eerdere bestellingen en
              facturen blijven bewaard.
            </p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteState === "saving"}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-button border border-red-400 bg-white px-4 font-heading text-body-sm font-semibold text-red-700 transition-colors duration-hover-fast hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteState === "saving" ? "Bezig…" : "Account verwijderen"}
            </button>
          </div>
        ) : null}
      </BusinessAccountSection>
    </div>
  );
}
