export type BusinessVatCountry = "NL" | "BE";

export interface VatResolution {
  country: BusinessVatCountry;
  regime: "STANDARD" | "REVERSE_CHARGE";
  ratePercent: number;
  invoiceNote: string;
}

const COUNTRY_DEFAULTS: Record<BusinessVatCountry, VatResolution> = {
  NL: {
    country: "NL",
    regime: "STANDARD",
    ratePercent: 9,
    invoiceNote: "",
  },
  BE: {
    country: "BE",
    regime: "REVERSE_CHARGE",
    ratePercent: 0,
    invoiceNote:
      "BTW verlegd naar de afnemer (intracommunautaire levering, art. 138 Btw-richtlijn / art. 39bis Belgisch Btw-Wetboek).",
  },
};

export function isSupportedBusinessCountry(country: string): country is BusinessVatCountry {
  return country === "NL" || country === "BE";
}

/**
 * Vereenvoudigde BTW-regel voor zakelijke klanten: NL=9% standaard,
 * BE=0% verlegd. Dit is een bewuste scope-keuze, geen volledige
 * EU-BTW-wetgeving (geen VIES-nummervalidatie, geen onderscheid
 * goederen/diensten) — passend bij een fysieke-productenwebshop.
 */
export function resolveVat(country: string): VatResolution {
  const normalized = country.trim().toUpperCase();
  if (!isSupportedBusinessCountry(normalized)) {
    throw new Error(`Onbekend land voor BTW-bepaling: ${country}`);
  }
  return COUNTRY_DEFAULTS[normalized];
}

export interface VatAmounts {
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
}

/** subtotalCents is altijd de excl.-BTW-basis. */
export function calculateVat(subtotalCents: number, ratePercent: number): VatAmounts {
  const vatAmountCents = Math.round(subtotalCents * (ratePercent / 100));
  return {
    subtotalCents,
    vatAmountCents,
    totalCents: subtotalCents + vatAmountCents,
  };
}
