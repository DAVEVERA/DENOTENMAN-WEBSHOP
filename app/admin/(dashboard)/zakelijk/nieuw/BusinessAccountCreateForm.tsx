"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, FileImage } from "lucide-react";
import { useRouter } from "next/navigation";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const inputClass = "mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const labelClass = "block text-body-sm font-semibold text-text";

const PICKUP_LOCATIONS = [
  { value: "hilvarenbeek", label: "Hilvarenbeek" },
  { value: "uden", label: "Uden" },
  { value: "antwerpen", label: "Antwerpen" },
  { value: "haaren", label: "Haaren (NB)" },
] as const;

export function BusinessAccountCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<"NL" | "BE">("NL");
  const [peppolConfigured, setPeppolConfigured] = useState(false);
  const [hasShippingAddress, setHasShippingAddress] = useState(false);
  const [hasBillingAddress, setHasBillingAddress] = useState(false);
  const [logoName, setLogoName] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const logo = form.get("logo");

    if (logo instanceof File && logo.size > 0) {
      if (logo.size > LOGO_MAX_BYTES || !LOGO_TYPES.has(logo.type)) {
        setError("Kies een PNG, JPG of WebP van maximaal 2 MB.");
        setBusy(false);
        return;
      }
    }

    const optional = (name: string) => String(form.get(name) ?? "").trim() || null;
    const payload = {
      companyName: String(form.get("companyName") ?? ""),
      contactName: String(form.get("contactName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: optional("phone"),
      country,
      kvkNumber: optional("kvkNumber"),
      vatNumber: optional("vatNumber"),
      peppolConfigured,
      peppolParticipantId: peppolConfigured ? optional("peppolParticipantId") : null,
      fixedPickupLocationId: optional("fixedPickupLocationId"),
      pickupFrequency: optional("pickupFrequency"),
      shippingEnabled: form.get("shippingEnabled") === "on",
      shippingStreet: hasShippingAddress ? optional("shippingStreet") : null,
      shippingHouseNumber: hasShippingAddress ? optional("shippingHouseNumber") : null,
      shippingPostalCode: hasShippingAddress ? optional("shippingPostalCode") : null,
      shippingCity: hasShippingAddress ? optional("shippingCity") : null,
      shippingCountry: hasShippingAddress ? optional("shippingCountry") : null,
      billingStreet: hasBillingAddress ? optional("billingStreet") : null,
      billingHouseNumber: hasBillingAddress ? optional("billingHouseNumber") : null,
      billingPostalCode: hasBillingAddress ? optional("billingPostalCode") : null,
      billingCity: hasBillingAddress ? optional("billingCity") : null,
      billingCountry: hasBillingAddress ? optional("billingCountry") : null,
      businessNewsletterOptIn: form.get("businessNewsletterOptIn") === "on",
      notes: optional("notes"),
      status: "APPROVED",
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (logo instanceof File && logo.size > 0) formData.append("logo", logo);

    try {
      const response = await fetch("/api/admin/business-accounts", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as {
        businessAccount?: { id: string };
        error?: string;
      } | null;
      if (!response.ok || !data?.businessAccount) {
        setError(
          data?.error === "EMAIL_ALREADY_EXISTS"
            ? "Dit e-mailadres is al gekoppeld aan een zakelijke klant."
            : data?.error === "LOGO_STORAGE_UNAVAILABLE"
              ? "Het logo kon niet worden opgeslagen. Het account is niet aangemaakt; probeer het opnieuw."
              : "Account aanmaken is mislukt. Controleer de gegevens en probeer opnieuw.",
        );
        return;
      }
      router.push(`/admin/zakelijk/${data.businessAccount.id}`);
      router.refresh();
    } catch {
      setError("De verbinding viel weg. Controleer of het account is aangemaakt voordat je opnieuw probeert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <CreateSection
        title="Klant en contact"
        description="De gegevens waarmee je de klant herkent en uitnodigt."
        defaultOpen
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bedrijfsnaam" name="companyName" autoComplete="organization" />
          <Field label="Contactpersoon" name="contactName" autoComplete="name" />
          <Field label="Zakelijk e-mailadres" name="email" type="email" autoComplete="email" />
          <Field label="Telefoonnummer (optioneel)" name="phone" type="tel" autoComplete="tel" required={false} />
        </div>
      </CreateSection>

      <CreateSection
        title="Bedrijfsregistratie"
        description="Land, bedrijfsnummers en eventuele Peppol-registratie."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Land
            <select name="country" value={country} onChange={(event) => setCountry(event.target.value as "NL" | "BE")} className={inputClass}>
              <option value="NL">Nederland</option>
              <option value="BE">België</option>
            </select>
          </label>
          <Field
            label={country === "BE" ? "Ondernemingsnummer (KBO)" : "KVK-nummer"}
            name="kvkNumber"
            autoComplete="off"
            required={false}
            placeholder={country === "BE" ? "Bijv. 0123.456.789" : "Bijv. 12345678"}
          />
          <Field
            label="BTW-nummer"
            name="vatNumber"
            autoComplete="off"
            required={false}
            placeholder={country === "BE" ? "Bijv. BE0123456789" : "Bijv. NL123456789B01"}
          />
        </div>
        <label className="mt-5 flex min-h-11 items-center gap-3 rounded-card border border-border bg-background px-4 py-3 text-body-sm font-semibold text-text">
          <input
            name="peppolConfigured"
            type="checkbox"
            checked={peppolConfigured}
            onChange={(event) => setPeppolConfigured(event.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          Deze klant is geregistreerd voor Peppol
        </label>
        {peppolConfigured ? (
          <div className="mt-4 max-w-xl">
            <Field
              label="Peppol participant-ID (optioneel)"
              name="peppolParticipantId"
              autoComplete="off"
              required={false}
              placeholder="Bijv. 0208:0123456789"
            />
            <p className="mt-1 text-xs text-muted">Leeg laten als de registratie bekend is, maar het participant-ID nog niet.</p>
          </div>
        ) : null}
      </CreateSection>

      <CreateSection
        title="Levering en afhalen"
        description="Leg een vaste afhaallocatie, ritme en optionele adressen vast."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Vaste afhaallocatie (optioneel)
            <select name="fixedPickupLocationId" className={inputClass} defaultValue="">
              <option value="">Geen vaste locatie</option>
              {PICKUP_LOCATIONS.map((location) => (
                <option key={location.value} value={location.value}>{location.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">De klant ziet in de afhaalagenda alleen dagen voor deze locatie.</span>
          </label>
          <label className={labelClass}>
            Afhaalfrequentie (optioneel)
            <select name="pickupFrequency" className={inputClass} defaultValue="">
              <option value="">Geen vast ritme</option>
              <option value="WEEKLY">Wekelijks</option>
              <option value="BIWEEKLY">Om de week</option>
              <option value="MONTHLY">Maandelijks</option>
              <option value="ON_REQUEST">Op aanvraag</option>
            </select>
          </label>
        </div>

        <label className="mt-5 flex min-h-11 items-center gap-3 rounded-card border border-border bg-background px-4 py-3 text-body-sm font-semibold text-text">
          <input name="shippingEnabled" type="checkbox" className="h-5 w-5 accent-accent" />
          Verzending toestaan voor deze klant
        </label>

        <label className="mt-3 flex min-h-11 items-center gap-3 text-body-sm font-semibold text-text">
          <input type="checkbox" checked={hasShippingAddress} onChange={(event) => setHasShippingAddress(event.target.checked)} className="h-5 w-5 accent-accent" />
          Verzendadres alvast invullen
        </label>
        {hasShippingAddress ? <AddressFields prefix="shipping" legend="Verzendadres" defaultCountry={country} /> : null}

        <label className="mt-3 flex min-h-11 items-center gap-3 text-body-sm font-semibold text-text">
          <input type="checkbox" checked={hasBillingAddress} onChange={(event) => setHasBillingAddress(event.target.checked)} className="h-5 w-5 accent-accent" />
          Afwijkend factuuradres invullen
        </label>
        {hasBillingAddress ? <AddressFields prefix="billing" legend="Factuuradres" defaultCountry={country} /> : null}
      </CreateSection>

      <CreateSection
        title="Logo en nieuwsbrief"
        description="Huisstijl voor nieuwe facturen en toestemming voor zakelijke updates."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Klantlogo (optioneel)
            <span className="mt-1 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-border bg-background px-4 py-5 text-center">
              <FileImage className="h-7 w-7 text-accent-ink" aria-hidden="true" />
              <span className="mt-2 font-heading text-body-sm font-bold text-text">{logoName ?? "Kies een logo"}</span>
              <span className="mt-1 text-xs font-normal text-muted">PNG, JPG of WebP, maximaal 2 MB</span>
            </span>
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => setLogoName(event.target.files?.[0]?.name ?? null)}
            />
          </label>
          <label className="flex min-h-28 items-start gap-3 rounded-card border border-border bg-background px-4 py-5 text-body-sm text-text">
            <input name="businessNewsletterOptIn" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
            <span>
              <strong className="font-heading">Aanmelden voor de zakelijke nieuwsbrief</strong>
              <span className="mt-1 block text-xs text-muted">Vink dit alleen aan als de klant toestemming heeft gegeven voor zakelijke updates.</span>
            </span>
          </label>
        </div>
      </CreateSection>

      <CreateSection
        title="Opmerkingen"
        description="Interne informatie die niet op de factuur of in de uitnodiging verschijnt."
      >
        <label className={labelClass}>
          Interne opmerkingen (optioneel)
          <textarea name="notes" rows={5} maxLength={4_000} className="mt-1 w-full rounded-button border border-border bg-background px-3 py-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
        </label>
      </CreateSection>

      <div className="rounded-panel border border-border bg-surface p-4 sm:p-5">
        <p className="text-body-sm text-muted">Het account wordt direct goedgekeurd. De klant krijgt pas toegang nadat jij vanuit het dossier de persoonlijke uitnodiging verstuurt.</p>
        <button type="submit" disabled={busy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60 sm:w-auto">
          {busy ? "Account aanmaken…" : "Account aanmaken"}
        </button>
        {error ? <p role="alert" className="mt-3 text-body-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}

function CreateSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen || undefined} className="group overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-details-marker]:hidden sm:px-6">
        <span>
          <span className="block font-heading text-heading-sm text-text">{title}</span>
          <span className="mt-0.5 block text-body-sm text-muted">{description}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-4 py-5 sm:px-6">{children}</div>
    </details>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function AddressFields({
  prefix,
  legend,
  defaultCountry,
}: {
  prefix: "shipping" | "billing";
  legend: string;
  defaultCountry: "NL" | "BE";
}) {
  return (
    <fieldset className="mt-3 rounded-card border border-border bg-background p-4">
      <legend className="px-1 font-heading text-body-sm font-bold text-text">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Straat" name={`${prefix}Street`} autoComplete={prefix === "shipping" ? "shipping address-line1" : "billing address-line1"} required={false} />
        <Field label="Huisnummer en toevoeging" name={`${prefix}HouseNumber`} autoComplete={prefix === "shipping" ? "shipping address-line2" : "billing address-line2"} required={false} />
        <Field label="Postcode" name={`${prefix}PostalCode`} autoComplete={prefix === "shipping" ? "shipping postal-code" : "billing postal-code"} required={false} />
        <Field label="Plaats" name={`${prefix}City`} autoComplete={prefix === "shipping" ? "shipping address-level2" : "billing address-level2"} required={false} />
        <label className={labelClass}>
          Land
          <select name={`${prefix}Country`} defaultValue={defaultCountry} className={inputClass}>
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
