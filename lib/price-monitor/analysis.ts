import type {
  DataQualityResult,
  MatchCandidate,
  MatchScore,
  NormalizedPrice,
  PriceMonitorPackageUnit,
  PriceRecommendationInput,
  PriceRecommendationResult,
  ScrapedCompetitorProduct,
} from "@/lib/price-monitor/types";

export const PRICE_COACH_RULES_VERSION = "price-coach-v1";
export const SIGNIFICANT_DIFFERENCE_BPS = 800;
export const MIN_ANALYSIS_QUALITY_SCORE = 75;
export const MIN_ACTION_CONFIDENCE_SCORE = 80;
const ACTION_BLOCKING_QUALITY_FLAGS = [
  "OUT_OF_STOCK",
  "COMPETITOR_PROMOTION",
  "UNVERIFIED_PRICE_SOURCE",
  "SUSPECT_OUTLIER",
  "MISSING_PACKAGE",
  "UNSUPPORTED_CURRENCY",
] as const;

const DUTCH_NUMBER = /-?\d[\d.,]*/;
const PACKAGE_UNIT_PATTERN = "kg|kilogram|kilo|g|gr|gram|ml|cl|l|liter|litre|stuks?|pcs?";

export function parsePriceCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  const match = cleaned.match(DUTCH_NUMBER);
  if (!match) return null;
  const raw = match[0];
  const decimalSeparator = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
  const normalized = decimalSeparator === ","
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return null;
  return Math.round(amount * 100);
}

export function parsePackageSize(value: string): {
  quantity: number | null;
  unit: PriceMonitorPackageUnit | null;
} {
  const normalized = value.toLocaleLowerCase("nl-NL").replace(/\u00a0/g, " ");
  const multi = normalized.match(
    new RegExp(`(\\d+)\\s*(?:x|\\u00d7)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${PACKAGE_UNIT_PATTERN})\\b`, "i")
  );
  if (multi) {
    const count = Number(multi[1]);
    const each = Number(multi[2].replace(",", "."));
    return normalizePackage(count * each, multi[3]);
  }
  const single = normalized.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${PACKAGE_UNIT_PATTERN})\\b`, "i")
  );
  if (!single) return { quantity: null, unit: null };
  return normalizePackage(Number(single[1].replace(",", ".")), single[2]);
}

function normalizePackage(quantity: number, rawUnit: string): {
  quantity: number | null;
  unit: PriceMonitorPackageUnit | null;
} {
  if (!Number.isFinite(quantity) || quantity <= 0) return { quantity: null, unit: null };
  const unit = rawUnit.toLowerCase();
  if (["kg", "kilogram", "kilo"].includes(unit)) {
    return { quantity: Math.round(quantity * 1000), unit: "GRAM" };
  }
  if (["g", "gr", "gram"].includes(unit)) {
    return { quantity: Math.round(quantity), unit: "GRAM" };
  }
  if (["l", "liter", "litre"].includes(unit)) {
    return { quantity: Math.round(quantity * 1000), unit: "MILLILITER" };
  }
  if (unit === "cl") return { quantity: Math.round(quantity * 10), unit: "MILLILITER" };
  if (unit === "ml") return { quantity: Math.round(quantity), unit: "MILLILITER" };
  return { quantity: Math.round(quantity), unit: "PIECE" };
}

export function normalizePrice(
  priceCents: number | null,
  quantity: number | null,
  unit: PriceMonitorPackageUnit | null
): NormalizedPrice {
  if (!priceCents || priceCents <= 0 || !quantity || quantity <= 0 || !unit) {
    return { normalizedPriceCents: null, normalizedUnit: null };
  }
  if (unit === "GRAM") {
    return {
      normalizedPriceCents: Math.round((priceCents * 1000) / quantity),
      normalizedUnit: "KILOGRAM",
    };
  }
  if (unit === "MILLILITER") {
    return {
      normalizedPriceCents: Math.round((priceCents * 1000) / quantity),
      normalizedUnit: "LITER",
    };
  }
  return {
    normalizedPriceCents: Math.round(priceCents / quantity),
    normalizedUnit: "PIECE",
  };
}

export function assessDataQuality(product: ScrapedCompetitorProduct): DataQualityResult {
  let score = 0;
  const flags: DataQualityResult["flags"] = [];
  if (product.name.trim().length >= 3) score += 15;
  else flags.push("MISSING_NAME");
  if (product.priceCents && product.priceCents > 0) score += 30;
  else flags.push(product.priceCents === null ? "MISSING_PRICE" : "INVALID_PRICE");
  if (product.packageQuantity && product.packageUnit) score += 25;
  else flags.push("MISSING_PACKAGE");
  if (product.currency.toUpperCase() === "EUR") score += 10;
  else flags.push("UNSUPPORTED_CURRENCY");
  if (product.description?.trim()) score += 5;
  else flags.push("MISSING_DESCRIPTION");
  if (/^https:\/\//i.test(product.sourceUrl)) score += 10;
  if (product.ean || product.sku) score += 5;
  if (product.inStock === false) flags.push("OUT_OF_STOCK");
  if (product.isPromotionalPrice) flags.push("COMPETITOR_PROMOTION");
  if (product.priceSource === "VISIBLE_FALLBACK") {
    flags.push("UNVERIFIED_PRICE_SOURCE");
    score = Math.max(0, score - 25);
  }

  const normalized = normalizePrice(product.priceCents, product.packageQuantity, product.packageUnit);
  if (
    normalized.normalizedUnit === "KILOGRAM" &&
    normalized.normalizedPriceCents &&
    (normalized.normalizedPriceCents < 200 || normalized.normalizedPriceCents > 20_000)
  ) {
    flags.push("SUSPECT_OUTLIER");
    score = Math.max(0, score - 20);
  }

  return {
    score: Math.min(100, score),
    flags,
    safeForAnalysis:
      score >= MIN_ANALYSIS_QUALITY_SCORE &&
      product.inStock !== false &&
      normalized.normalizedPriceCents !== null &&
      !flags.some((flag) => ACTION_BLOCKING_QUALITY_FLAGS.includes(
        flag as (typeof ACTION_BLOCKING_QUALITY_FLAGS)[number]
      )),
  };
}

export function scoreProductMatch(candidate: MatchCandidate): MatchScore {
  const ownSku = normalizeIdentifier(candidate.ownSku);
  const competitorSku = normalizeIdentifier(candidate.competitorSku || "");
  if (competitorSku && competitorSku === ownSku) {
    return { score: 98, reason: "Exacte SKU-overeenkomst", exact: true };
  }

  const nameSimilarity = jaccard(tokenize(candidate.ownName), tokenize(candidate.competitorName));
  const sameWeight =
    candidate.competitorUnit === "GRAM" &&
    candidate.competitorQuantity !== null &&
    Math.abs(candidate.ownWeightGrams - candidate.competitorQuantity) <=
      Math.max(5, candidate.ownWeightGrams * 0.02);
  const score = Math.round(nameSimilarity * 75 + (sameWeight ? 20 : 0));
  return {
    score: Math.min(95, score),
    reason: sameWeight
      ? `Naam lijkt voor ${Math.round(nameSimilarity * 100)}% gelijk en het gewicht komt overeen`
      : `Naam lijkt voor ${Math.round(nameSimilarity * 100)}% gelijk; controleer het gewicht`,
    exact: false,
  };
}

export function buildPriceRecommendation(
  input: PriceRecommendationInput
): PriceRecommendationResult {
  const competitorEquivalent =
    input.competitorNormalizedUnit === "KILOGRAM" && input.competitorNormalizedPriceCents
      ? Math.round((input.competitorNormalizedPriceCents * input.ownWeightGrams) / 1000)
      : 0;
  if (!competitorEquivalent || input.currentPriceCents <= 0) {
    return reviewRecommendation(input.currentPriceCents, 0, "De verpakkingen zijn nog niet betrouwbaar vergelijkbaar.");
  }

  const blockingFlag = ACTION_BLOCKING_QUALITY_FLAGS.find((flag) =>
    input.qualityFlags?.includes(flag)
  );
  if (blockingFlag) {
    return reviewRecommendation(
      input.currentPriceCents,
      competitorEquivalent,
      blockingFlag === "OUT_OF_STOCK"
        ? "Het concurrentproduct is niet op voorraad. Gebruik deze prijs daarom niet voor een prijsactie."
        : "De brongegevens bevatten een blokkade. Controleer verpakking, valuta en prijsuitschieters eerst handmatig."
    );
  }

  const differenceBps = Math.round(
    ((input.currentPriceCents - competitorEquivalent) / competitorEquivalent) * 10_000
  );
  const confidenceScore = Math.min(input.matchConfidenceScore, input.dataQualityScore);
  if (
    input.matchConfidenceScore < MIN_ACTION_CONFIDENCE_SCORE ||
    input.dataQualityScore < MIN_ANALYSIS_QUALITY_SCORE
  ) {
    return reviewRecommendation(
      input.currentPriceCents,
      competitorEquivalent,
      "De productmatch of de scrape is nog niet betrouwbaar genoeg voor een prijsactie.",
      differenceBps,
      confidenceScore
    );
  }

  if (Math.abs(differenceBps) < SIGNIFICANT_DIFFERENCE_BPS) {
    return {
      type: "KEEP",
      currentPriceCents: input.currentPriceCents,
      competitorEquivalentPriceCents: competitorEquivalent,
      suggestedPriceCents: input.currentPriceCents,
      differenceBps,
      scenarioImpactPer100Cents: 0,
      confidenceScore,
      rationale: "Het prijsverschil is kleiner dan 8%. De prijscoach adviseert daarom nog niets te wijzigen.",
      caveat: "Controleer acties altijd op inkoopprijs, btw, positionering en voorraad; die gegevens zitten niet in de scrape.",
      significant: false,
    };
  }

  const midpoint = Math.round((input.currentPriceCents + competitorEquivalent) / 2);
  let suggestedPriceCents: number;
  let type: "LOWER" | "RAISE";
  if (differenceBps > 0) {
    type = "LOWER";
    const lowestAllowed = Math.round(input.currentPriceCents * 0.88);
    const premiumFloor = Math.round(competitorEquivalent * 1.03);
    suggestedPriceCents = Math.max(
      lowestAllowed,
      roundToFive(Math.max(premiumFloor, midpoint))
    );
  } else {
    type = "RAISE";
    const highestAllowed = Math.round(input.currentPriceCents * 1.1);
    const competitiveCeiling = Math.round(competitorEquivalent * 0.97);
    suggestedPriceCents = Math.min(
      highestAllowed,
      roundToFive(Math.min(competitiveCeiling, midpoint))
    );
  }
  if (suggestedPriceCents === input.currentPriceCents) type = differenceBps > 0 ? "LOWER" : "RAISE";

  return {
    type,
    currentPriceCents: input.currentPriceCents,
    competitorEquivalentPriceCents: competitorEquivalent,
    suggestedPriceCents,
    differenceBps,
    scenarioImpactPer100Cents: (suggestedPriceCents - input.currentPriceCents) * 100,
    confidenceScore,
    rationale:
      type === "LOWER"
        ? "Je prijs ligt duidelijk hoger. De prijscoach stelt een voorzichtige stap richting de concurrent voor, met maximaal 12% verlaging."
        : "Je prijs ligt duidelijk lager. De prijscoach ziet ruimte voor een voorzichtige verhoging, met maximaal 10% en nog onder de concurrent.",
    caveat: "Dit is een omzet-scenario bij 100 verkochte verpakkingen, geen winstprognose. Controleer eerst inkoopprijs, btw, positionering en voorraad.",
    significant: true,
  };
}

export function validatePriceAction(input: {
  currentPriceCents: number;
  expectedCurrentPriceCents: number;
  targetPriceCents: number;
  marginChecked: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.currentPriceCents !== input.expectedCurrentPriceCents) {
    return { ok: false, error: "STALE_PRICE" };
  }
  if (!input.marginChecked) return { ok: false, error: "MARGIN_CHECK_REQUIRED" };
  if (!Number.isInteger(input.targetPriceCents) || input.targetPriceCents < 50 || input.targetPriceCents > 100_000) {
    return { ok: false, error: "PRICE_OUT_OF_RANGE" };
  }
  if (input.targetPriceCents === input.currentPriceCents) {
    return { ok: false, error: "PRICE_UNCHANGED" };
  }
  const change = Math.abs(input.targetPriceCents - input.currentPriceCents) / input.currentPriceCents;
  if (change > 0.15) return { ok: false, error: "CHANGE_TOO_LARGE" };
  return { ok: true };
}

function reviewRecommendation(
  currentPriceCents: number,
  competitorEquivalentPriceCents: number,
  rationale: string,
  differenceBps = 0,
  confidenceScore = 0
): PriceRecommendationResult {
  return {
    type: "REVIEW",
    currentPriceCents,
    competitorEquivalentPriceCents,
    suggestedPriceCents: currentPriceCents,
    differenceBps,
    scenarioImpactPer100Cents: 0,
    confidenceScore,
    rationale,
    caveat: "Laat de productmatch en verpakking eerst door een beheerder controleren.",
    significant: false,
  };
}

function normalizeIdentifier(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function tokenize(value: string): Set<string> {
  const stop = new Set(["de", "het", "een", "gram", "gr", "kg", "kilo", "noten", "noot"]);
  return new Set(
    value
      .toLocaleLowerCase("nl-NL")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\d+(?:[.,]\d+)?/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => (token.length > 5 && token.endsWith("e") ? token.slice(0, -1) : token))
      .filter((token) => token.length >= 2 && !stop.has(token))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}
