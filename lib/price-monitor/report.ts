import type { PriceMonitorDashboard } from "@/lib/price-monitor/types";

export function priceMonitorCsv(dashboard: PriceMonitorDashboard): string {
  const rows: Array<Array<string | number>> = [
    [
      "Eigen product",
      "Variant",
      "SKU",
      "Concurrent",
      "Concurrentproduct",
      "Onze prijs",
      "Concurrentprijs gelijk gewicht",
      "Onze prijs per kg",
      "Concurrentprijs per kg",
      "Verschil procent",
      "Matchstatus",
      "Matchzekerheid",
      "Datakwaliteit",
      "Geschikt voor analyse",
      "Datakwaliteitsmeldingen",
      "Advies",
      "Voorgestelde prijs",
      "Scenario per 100",
      "Bron-URL",
      "Gemeten op",
    ],
  ];
  for (const item of dashboard.comparisons) {
    rows.push([
      item.ownProduct,
      item.ownVariant,
      item.ownSku,
      item.competitor,
      item.competitorProduct,
      cents(item.ownPriceCents),
      cents(item.competitorEquivalentPriceCents),
      cents(item.ownNormalizedPriceCents),
      cents(item.competitorNormalizedPriceCents),
      (item.differenceBps / 100).toFixed(2),
      item.matchStatus,
      item.matchConfidenceScore,
      item.dataQualityScore,
      item.safeForAnalysis ? "JA" : "NEE",
      item.qualityFlags.join(", "),
      item.recommendationType || "",
      item.suggestedPriceCents === null ? "" : cents(item.suggestedPriceCents),
      item.scenarioImpactPer100Cents === null ? "" : cents(item.scenarioImpactPer100Cents),
      item.competitorUrl,
      item.observedAt,
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function priceMonitorJson(dashboard: PriceMonitorDashboard): string {
  return JSON.stringify(
    {
      meta: {
        title: "De Notenman prijsmonitor",
        generatedAt: dashboard.generatedAt,
        note: "Vergelijkingen zijn omgerekend naar gelijk gewicht. Controleer inkoopprijs en marge voor uitvoering.",
      },
      summary: dashboard.summary,
      sources: dashboard.sources,
      comparisons: dashboard.comparisons,
    },
    null,
    2
  );
}

function cents(value: number): string {
  return (value / 100).toFixed(2);
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const neutralized =
    typeof value === "string" &&
    (/^[\t\r ]*[=+@]/.test(raw) || /^[\t\r ]*-(?!\d+(?:[.,]\d+)?$)/.test(raw))
      ? `'${raw}`
      : raw;
  const text = neutralized.replace(/"/g, '""');
  return `"${text}"`;
}
