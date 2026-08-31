export type PriceMonitorPackageUnit = "GRAM" | "MILLILITER" | "PIECE";

export type PriceMonitorQualityFlag =
  | "MISSING_NAME"
  | "MISSING_PRICE"
  | "INVALID_PRICE"
  | "MISSING_PACKAGE"
  | "UNSUPPORTED_CURRENCY"
  | "MISSING_DESCRIPTION"
  | "OUT_OF_STOCK"
  | "COMPETITOR_PROMOTION"
  | "UNVERIFIED_PRICE_SOURCE"
  | "STALE"
  | "SUSPECT_OUTLIER";

export type ScrapedCompetitorProduct = {
  sourceKey: string;
  sourceUrl: string;
  externalKey?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  ean?: string | null;
  priceCents: number | null;
  currency: string;
  packageQuantity: number | null;
  packageUnit: PriceMonitorPackageUnit | null;
  inStock?: boolean | null;
  isPromotionalPrice?: boolean;
  priceSource?: "STRUCTURED" | "PRODUCT_META" | "WOO_VARIATION" | "VISIBLE_FALLBACK";
  raw?: Record<string, unknown>;
};

export type NormalizedPrice = {
  normalizedPriceCents: number | null;
  normalizedUnit: "KILOGRAM" | "LITER" | "PIECE" | null;
};

export type DataQualityResult = {
  score: number;
  flags: PriceMonitorQualityFlag[];
  safeForAnalysis: boolean;
};

export type MatchCandidate = {
  variantId: string;
  ownSku: string;
  ownName: string;
  ownWeightGrams: number;
  competitorSku?: string | null;
  competitorEan?: string | null;
  competitorName: string;
  competitorQuantity: number | null;
  competitorUnit: PriceMonitorPackageUnit | null;
};

export type MatchScore = {
  score: number;
  reason: string;
  exact: boolean;
};

export type PriceRecommendationInput = {
  currentPriceCents: number;
  ownWeightGrams: number;
  competitorNormalizedPriceCents: number | null;
  competitorNormalizedUnit: "KILOGRAM" | "LITER" | "PIECE" | null;
  matchConfidenceScore: number;
  dataQualityScore: number;
  qualityFlags?: PriceMonitorQualityFlag[];
};

export type PriceRecommendationResult = {
  type: "LOWER" | "RAISE" | "KEEP" | "REVIEW";
  currentPriceCents: number;
  competitorEquivalentPriceCents: number;
  suggestedPriceCents: number;
  differenceBps: number;
  scenarioImpactPer100Cents: number;
  confidenceScore: number;
  rationale: string;
  caveat: string;
  significant: boolean;
};

export type PriceMonitorSourceView = {
  key: string;
  name: string;
  baseUrl: string;
  status: "READY" | "NEEDS_SETUP" | "PAUSED";
  statusLabel: string;
  statusNote: string;
  canRun: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  productsSeen: number;
};

export type PriceMonitorComparisonView = {
  matchId: string;
  recommendationId: string | null;
  variantId: string;
  ownProduct: string;
  ownVariant: string;
  ownSku: string;
  competitor: string;
  competitorProduct: string;
  competitorUrl: string;
  ownPriceCents: number;
  competitorEquivalentPriceCents: number;
  ownNormalizedPriceCents: number;
  competitorNormalizedPriceCents: number;
  differenceBps: number;
  matchStatus: "SUGGESTED" | "APPROVED" | "REJECTED";
  matchConfidenceScore: number;
  dataQualityScore: number;
  qualityFlags: string[];
  safeForAnalysis: boolean;
  observedAt: string;
  recommendationType: "LOWER" | "RAISE" | "KEEP" | "REVIEW" | null;
  suggestedPriceCents: number | null;
  scenarioImpactPer100Cents: number | null;
  rationale: string | null;
  recommendationStatus: string | null;
};

export type PriceMonitorDashboard = {
  generatedAt: string;
  setupRequired: boolean;
  summary: {
    connectedSources: number;
    totalSources: number;
    productsObserved: number;
    approvedMatches: number;
    matchesToReview: number;
    significantDifferences: number;
    openActions: number;
    averageDataQualityScore: number | null;
    opportunityPer100Cents: number;
  };
  sources: PriceMonitorSourceView[];
  comparisons: PriceMonitorComparisonView[];
  schedule: {
    id: string | null;
    enabled: boolean;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    hourLocal: number;
    recipientEmail: string;
    formats: string[];
    minDifferencePercent: number;
    nextRunAt: string | null;
    lastSentAt: string | null;
    lastStatus: string;
    lastError: string | null;
  };
};

export type PriceMonitorApexScanSource = {
  domain: string;
  productCount: number;
  priceRowCount: number;
};

export type PriceMonitorApexScanSummary = {
  id: string;
  scraperFile: string;
  resultFile: string;
  capturedAt: string;
  listedSources: number;
  sourcesWithResults: number;
  productCount: number;
  priceRowCount: number;
  rowsWithSku: number;
  rowsWithPackage: number;
  readyForComparisonRows: number;
  invalidPriceRows: number;
  suspectHighPriceRows: number;
  sources: PriceMonitorApexScanSource[];
};

export type PriceMonitorApexScanItem = {
  id: string;
  domain: string;
  productName: string;
  variantName: string;
  productUrl: string | null;
  priceCents: number | null;
  comparePriceCents: number | null;
  sku: string | null;
  packageLabel: string | null;
  unitPriceCents: number | null;
  safeForComparison: boolean;
  qualityIssues: string[];
};

export type PriceMonitorApexScanPage = {
  total: number;
  offset: number;
  limit: number;
  items: PriceMonitorApexScanItem[];
};
