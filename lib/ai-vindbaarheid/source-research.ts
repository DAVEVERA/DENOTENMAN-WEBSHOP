/**
 * Deterministic source discovery preparation for the multilingual product fact audit.
 * This module prepares searches and triages candidate sources. An external search
 * adapter must provide actual results; candidates are NEVER verified automatically.
 */
export type ProductResearchTarget = {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  brand?: string | null;
  supplier?: string | null;
  weightGrams?: number | null;
  field: "ingredients" | "allergens" | "mayContainTraces" | "nutrition";
};

export type ResearchCandidate = {
  url: string;
  title: string;
  excerpt: string;
  sourceType: "manufacturer" | "supplier" | "label" | "retailer" | "unknown";
  retrievedAt: string;
};

export type ReviewedResearchCandidate = ResearchCandidate & {
  exactSkuMentioned: boolean;
  hasProductName: boolean;
  needsManualVerification: true;
  confidenceSignals: string[];
};

function cleaned(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** A SKU must be a complete identifier, not a prefix of another variant. */
function mentionsExactSku(text: string, sku: string): boolean {
  if (!sku) return false;
  const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9_-])${escaped}(?=$|[^a-z0-9_-])`, "i").test(text);
}

function quoted(value: string): string {
  return `"${value.replace(/"/g, "")}"`;
}

export function buildProductResearchQueries(target: ProductResearchTarget): string[] {
  const name = cleaned(target.productName);
  const sku = cleaned(target.sku);
  const brand = cleaned(target.brand);
  const supplier = cleaned(target.supplier);
  const fieldNames = {
    ingredients: ["ingrediënten", "ingredients", "Zutaten"],
    allergens: ["allergenen", "allergens"],
    mayContainTraces: ["sporen allergenen", "may contain traces"],
    nutrition: ["voedingswaarden per 100g", "nutrition facts per 100g"],
  }[target.field];
  const terms = [brand, supplier, name].filter(Boolean);
  const product = terms.join(" ");
  const context = target.weightGrams && target.weightGrams > 0 ? ` ${target.weightGrams}g` : "";
  const queries = [
    sku ? `${quoted(sku)} ${fieldNames[0]} productspecificatie` : "",
    product ? `${quoted(product)}${context} ${fieldNames[0]} etiket` : "",
    name ? `${quoted(name)}${context} ${fieldNames[1] ?? fieldNames[0]} leverancier pdf` : "",
    supplier && sku ? `${quoted(supplier)} ${quoted(sku)} datasheet` : "",
  ];
  return [...new Set(queries.filter(Boolean))];
}

export function triageResearchCandidates(
  target: ProductResearchTarget,
  candidates: readonly ResearchCandidate[],
): ReviewedResearchCandidate[] {
  const sku = cleaned(target.sku).toLocaleLowerCase("nl-NL");
  const name = cleaned(target.productName).toLocaleLowerCase("nl-NL");
  return candidates.map((candidate) => {
    const haystack = `${candidate.title} ${candidate.excerpt}`.toLocaleLowerCase("nl-NL");
    // Matching a search excerpt is only a hint, never proof of correct formulation.
    const exactSkuMentioned = mentionsExactSku(haystack, sku);
    const hasProductName = Boolean(name && haystack.includes(name));
    const confidenceSignals = [
      ...(exactSkuMentioned ? ["SKU vermeld in zoekresultaat"] : []),
      ...(hasProductName ? ["Productnaam vermeld in zoekresultaat"] : []),
      ...(candidate.sourceType === "manufacturer" || candidate.sourceType === "supplier" || candidate.sourceType === "label"
        ? ["Mogelijke primaire bron"] : []),
    ];
    return { ...candidate, exactSkuMentioned, hasProductName, needsManualVerification: true as const, confidenceSignals };
  }).sort((a, b) =>
    (Number(b.exactSkuMentioned) * 2 + Number(b.hasProductName) + Number(b.sourceType !== "retailer" && b.sourceType !== "unknown")) -
    (Number(a.exactSkuMentioned) * 2 + Number(a.hasProductName) + Number(a.sourceType !== "retailer" && a.sourceType !== "unknown"))
  );
}
