/**
 * Pure aggregation for AI Vindbaarheid dashboard widgets.
 * Only audited, versioned product snapshots may contribute to quality metrics.
 * Missing audits are excluded from scores but included in coverage.
 */
export type ProductQualityMeasurement = {
  productId: string;
  measuredAt: string;
  overallScore: number;
  requiredFields: number;
  filledFields: number;
  localesComplete: number;
  localesExpected: number;
  openFindings: number;
};

export type AiVisibilityDashboardSummary = {
  activeProducts: number;
  auditedProducts: number;
  coveragePercent: number | null;
  qualityScore: number | null;
  completenessPercent: number | null;
  languageCoveragePercent: number | null;
  openFindings: number | null;
  measuredAt: string | null;
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

export function summarizeAiVisibilityQuality(
  activeProducts: number,
  measurements: readonly ProductQualityMeasurement[],
): AiVisibilityDashboardSummary {
  const latestByProduct = new Map<string, ProductQualityMeasurement>();
  for (const entry of measurements) {
    if (!Number.isFinite(Date.parse(entry.measuredAt))) continue;
    const previous = latestByProduct.get(entry.productId);
    if (!previous || Date.parse(entry.measuredAt) > Date.parse(previous.measuredAt)) {
      latestByProduct.set(entry.productId, entry);
    }
  }
  const values = [...latestByProduct.values()];
  const sum = (select: (entry: ProductQualityMeasurement) => number): number =>
    values.reduce((total, entry) => total + select(entry), 0);
  const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
  const scoreEntries = values.filter((entry) => Number.isFinite(entry.overallScore));
  const fields = values.filter((entry) => entry.requiredFields > 0 && entry.filledFields >= 0);
  const locales = values.filter((entry) => entry.localesExpected > 0 && entry.localesComplete >= 0);
  return {
    activeProducts,
    auditedProducts: values.length,
    coveragePercent: ratio(values.length, activeProducts),
    qualityScore: scoreEntries.length ? Math.round(sum((entry) => scoreEntries.includes(entry) ? clampPercent(entry.overallScore) : 0) / scoreEntries.length) : null,
    completenessPercent: fields.length ? ratio(fields.reduce((total, entry) => total + Math.min(entry.filledFields, entry.requiredFields), 0), fields.reduce((total, entry) => total + entry.requiredFields, 0)) : null,
    languageCoveragePercent: locales.length ? ratio(locales.reduce((total, entry) => total + Math.min(entry.localesComplete, entry.localesExpected), 0), locales.reduce((total, entry) => total + entry.localesExpected, 0)) : null,
    openFindings: values.length ? sum((entry) => Math.max(0, entry.openFindings)) : null,
    measuredAt: values.length ? values.reduce((latest, entry) => entry.measuredAt > latest ? entry.measuredAt : latest, values[0].measuredAt) : null,
  };
}
