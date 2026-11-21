/**
 * Read-only triage for multilingual product facts. Never infer that a majority
 * of translations is true: only verified, variant-specific source evidence
 * can authorize a fact update.
 */
export type FactLocale = "nl" | "en" | "fr";
export type FactKind = "ingredients" | "allergens" | "mayContainTraces" | "nutrition";
export type FactEvidence = {
  sourceId: string;
  verified: boolean;
  value: string;
  /** Identifies the precise SKU / recipe / variant for which the evidence applies. */
  variantId: string;
};
export type LocalizedFact = { locale: FactLocale; value: string | null };
export type FactReconciliationInput = {
  productId: string;
  variantId: string;
  kind: FactKind;
  translations: LocalizedFact[];
  evidence: FactEvidence[];
};
export type FactReconciliationPlan = {
  action: "translate_verified_source" | "verify_source" | "research_online";
  field: FactKind;
  productId: string;
  variantId: string;
  missingLocales: FactLocale[];
  /** AI may draft text, but this result never authorizes publication. */
  requiresApproval: true;
  verifiedSource: { sourceId: string; value: string } | null;
  reason: string;
};

const LOCALES: readonly FactLocale[] = ["nl", "en", "fr"];

export function planFactReconciliation(input: FactReconciliationInput): FactReconciliationPlan {
  const missingLocales = LOCALES.filter((locale) =>
    !input.translations.some((entry) => entry.locale === locale && entry.value?.trim())
  );
  const verified = input.evidence.filter((entry) =>
    entry.verified && entry.variantId === input.variantId && entry.value.trim()
  );
  const uniqueValues = new Set(verified.map((entry) => entry.value.trim()));
  if (uniqueValues.size > 1) {
    return {
      action: "verify_source", field: input.kind, productId: input.productId,
      variantId: input.variantId, missingLocales, requiresApproval: true,
      verifiedSource: null, reason: "Geverifieerde bronnen spreken elkaar tegen; menselijke broncontrole vereist.",
    };
  }
  if (uniqueValues.size === 0) {
    return {
      action: "research_online", field: input.kind, productId: input.productId,
      variantId: input.variantId, missingLocales, requiresApproval: true,
      verifiedSource: null, reason: "Zoek actief naar de exacte productvariant via leveranciers, etiket- of productspecificaties en vergelijk bewijs. Tot verificatie: markeer dit veld zichtbaar als onderzoek vereist; vul geen onbewezen feiten in.",
    };
  }
  const source = verified[0];
  return {
    action: "translate_verified_source", field: input.kind, productId: input.productId,
    variantId: input.variantId, missingLocales, requiresApproval: true,
    verifiedSource: { sourceId: source.sourceId, value: source.value.trim() },
    reason: "Laat AI uitsluitend de geverifieerde bron naar NL, EN en FR vertalen en afwijkingen ter goedkeuring aanbieden.",
  };
}
