import "server-only";

import {
  PriceMonitorMatchStatus,
  PriceMonitorRecommendationStatus,
  Prisma,
  type AdminUser,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/admin-audit";
import {
  assessDataQuality,
  buildPriceRecommendation,
  normalizePrice,
  PRICE_COACH_RULES_VERSION,
  scoreProductMatch,
  validatePriceAction,
} from "@/lib/price-monitor/analysis";
import { nextPriceReportRun } from "@/lib/price-monitor/schedule";
import { getPriceMonitorAdapter } from "@/lib/price-monitor/scrapers/registry";
import { PRICE_MONITOR_SOURCES, getPriceMonitorSource } from "@/lib/price-monitor/sources";
import type {
  PriceMonitorDashboard,
  PriceMonitorQualityFlag,
  ScrapedCompetitorProduct,
} from "@/lib/price-monitor/types";

export const PRICE_MONITOR_OBSERVATION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export class PriceMonitorServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

export async function getPriceMonitorDashboard(): Promise<PriceMonitorDashboard> {
  const [sourceRows, matches, schedule] = await Promise.all([
    prisma.priceMonitorSource.findMany({
      orderBy: { name: "asc" },
      include: {
        crawlRuns: { orderBy: { startedAt: "desc" }, take: 1 },
        _count: { select: { products: true } },
      },
    }),
    prisma.priceMonitorMatch.findMany({
      where: { status: { not: "REJECTED" } },
      orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
      include: {
        productVariant: {
          include: {
            product: { include: { translations: { where: { locale: "nl" }, take: 1 } } },
            translations: { where: { locale: "nl" }, take: 1 },
          },
        },
        competitorProduct: {
          include: {
            source: true,
            observations: { orderBy: { observedAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.priceMonitorReportSchedule.findFirst({ orderBy: { updatedAt: "desc" } }),
  ]);

  const latestObservationIds = matches.flatMap((match) => {
    const observation = match.competitorProduct.observations[0];
    return observation ? [observation.id] : [];
  });
  const latestRecommendations = latestObservationIds.length
    ? await prisma.pricingRecommendation.findMany({
        where: { observationId: { in: latestObservationIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const recommendationByEvidence = new Map(
    latestRecommendations.map((recommendation) => [
      `${recommendation.matchId}:${recommendation.observationId}`,
      recommendation,
    ])
  );

  const dashboardGeneratedAt = new Date();
  const comparisons = matches.flatMap((match) => {
    const observation = match.competitorProduct.observations[0];
    if (
      !observation?.normalizedPriceCents ||
      observation.normalizedUnit !== "KILOGRAM" ||
      match.productVariant.weightGrams <= 0
    ) return [];
    const variant = match.productVariant;
    const ownPriceCents = variant.salePriceCents ?? variant.priceCents;
    const ownNormalizedPriceCents = Math.round((ownPriceCents * 1000) / variant.weightGrams);
    const competitorEquivalentPriceCents = Math.round(
      (observation.normalizedPriceCents * variant.weightGrams) / 1000
    );
    const differenceBps = Math.round(
      ((ownPriceCents - competitorEquivalentPriceCents) / competitorEquivalentPriceCents) * 10_000
    );
    const recommendation = recommendationByEvidence.get(`${match.id}:${observation.id}`);
    const stale =
      dashboardGeneratedAt.getTime() - observation.observedAt.getTime() >
      PRICE_MONITOR_OBSERVATION_MAX_AGE_MS;
    const qualityFlags = [
      ...observation.qualityFlags,
      ...(stale && !observation.qualityFlags.includes("STALE") ? ["STALE"] : []),
    ];
    const safeForAnalysis =
      match.status === "APPROVED" &&
      observation.dataQualityScore >= 75 &&
      !qualityFlags.some((flag) =>
        [
          "STALE",
          "OUT_OF_STOCK",
          "COMPETITOR_PROMOTION",
          "UNVERIFIED_PRICE_SOURCE",
          "SUSPECT_OUTLIER",
          "MISSING_PACKAGE",
          "UNSUPPORTED_CURRENCY",
        ].includes(flag)
      );
    return [{
      matchId: match.id,
      recommendationId: recommendation?.id || null,
      variantId: variant.id,
      ownProduct: variant.product.translations[0]?.name || variant.product.slug,
      ownVariant: variant.translations[0]?.label || `${variant.weightGrams} gram`,
      ownSku: variant.sku,
      competitor: match.competitorProduct.source.name,
      competitorProduct: match.competitorProduct.canonicalName,
      competitorUrl: match.competitorProduct.sourceUrl,
      ownPriceCents,
      competitorEquivalentPriceCents,
      ownNormalizedPriceCents,
      competitorNormalizedPriceCents: observation.normalizedPriceCents,
      differenceBps,
      matchStatus: match.status,
      matchConfidenceScore: match.confidenceScore,
      dataQualityScore: observation.dataQualityScore,
      qualityFlags,
      safeForAnalysis,
      observedAt: observation.observedAt.toISOString(),
      recommendationType: recommendation?.type || null,
      suggestedPriceCents: recommendation?.suggestedPriceCents ?? null,
      scenarioImpactPer100Cents: recommendation?.scenarioImpactPer100Cents ?? null,
      rationale: recommendation?.rationale || null,
      recommendationStatus: recommendation?.status || null,
    }];
  });

  const qualityScores = sourceRows.flatMap((source) => {
    const score = source.crawlRuns[0]?.dataQualityScore;
    return score === null || score === undefined ? [] : [score];
  });
  const sourceViews = PRICE_MONITOR_SOURCES.map((definition) => {
    const row = sourceRows.find((source) => source.key === definition.key);
    const lastRun = row?.crawlRuns[0];
    const effectiveStatus = definition.canRun ? row?.status || definition.status : "NEEDS_SETUP";
    return {
      key: definition.key,
      name: definition.name,
      baseUrl: definition.baseUrl,
      status: effectiveStatus,
      statusLabel: definition.statusLabel,
      statusNote: row?.statusNote || definition.statusNote,
      canRun: definition.canRun && effectiveStatus === "READY",
      lastRunAt: lastRun?.finishedAt?.toISOString() || lastRun?.startedAt.toISOString() || null,
      lastRunStatus: lastRun?.status || null,
      productsSeen: row?._count.products || 0,
    };
  });
  return {
    generatedAt: dashboardGeneratedAt.toISOString(),
    setupRequired: false,
    summary: {
      connectedSources: sourceViews.filter((source) => source.canRun).length,
      totalSources: PRICE_MONITOR_SOURCES.length,
      productsObserved: sourceRows.reduce((total, source) => total + source._count.products, 0),
      approvedMatches: comparisons.filter((item) => item.matchStatus === "APPROVED").length,
      matchesToReview: comparisons.filter((item) => item.matchStatus === "SUGGESTED").length,
      significantDifferences: comparisons.filter(
        (item) => item.safeForAnalysis && Math.abs(item.differenceBps) >= 800
      ).length,
      openActions: comparisons.filter(
        (item) =>
          item.safeForAnalysis &&
          item.recommendationStatus === "OPEN" &&
          (item.recommendationType === "LOWER" || item.recommendationType === "RAISE")
      ).length,
      averageDataQualityScore: qualityScores.length
        ? Math.round(qualityScores.reduce((total, score) => total + score, 0) / qualityScores.length)
        : null,
      opportunityPer100Cents: comparisons.reduce(
        (total, item) =>
          total + (item.safeForAnalysis ? Math.max(0, item.scenarioImpactPer100Cents || 0) : 0),
        0
      ),
    },
    sources: sourceViews,
    comparisons,
    schedule: {
      id: schedule?.id || null,
      enabled: schedule?.enabled || false,
      frequency: schedule?.frequency || "WEEKLY",
      hourLocal: schedule?.hourLocal ?? 7,
      recipientEmail: schedule?.recipientEmail || "",
      formats: schedule?.formats || ["CSV"],
      minDifferencePercent: (schedule?.minDifferenceBps || 1000) / 100,
      nextRunAt: schedule?.nextRunAt?.toISOString() || null,
      lastSentAt: schedule?.lastSentAt?.toISOString() || null,
      lastStatus: schedule?.lastStatus || "NEVER",
      lastError: schedule?.lastError || null,
    },
  };
}

export function emptyPriceMonitorDashboard(setupRequired = true): PriceMonitorDashboard {
  return {
    generatedAt: new Date().toISOString(),
    setupRequired,
    summary: {
      connectedSources: PRICE_MONITOR_SOURCES.filter((source) => source.canRun).length,
      totalSources: PRICE_MONITOR_SOURCES.length,
      productsObserved: 0,
      approvedMatches: 0,
      matchesToReview: 0,
      significantDifferences: 0,
      openActions: 0,
      averageDataQualityScore: null,
      opportunityPer100Cents: 0,
    },
    sources: PRICE_MONITOR_SOURCES.map((source) => ({
      ...source,
      lastRunAt: null,
      lastRunStatus: null,
      productsSeen: 0,
    })),
    comparisons: [],
    schedule: {
      id: null,
      enabled: false,
      frequency: "WEEKLY",
      hourLocal: 7,
      recipientEmail: "",
      formats: ["CSV"],
      minDifferencePercent: 10,
      nextRunAt: null,
      lastSentAt: null,
      lastStatus: "NEVER",
      lastError: null,
    },
  };
}

export async function queuePriceMonitorSourceRun(input: {
  sourceKey: string;
  limit: number;
  admin: AdminUser;
}): Promise<{ runId: string; status: "RUNNING" }> {
  const definition = getPriceMonitorSource(input.sourceKey);
  const adapter = getPriceMonitorAdapter(input.sourceKey);
  if (!definition) throw new PriceMonitorServiceError("SOURCE_NOT_FOUND", 404);
  if (!definition.canRun || !adapter) throw new PriceMonitorServiceError("SOURCE_NEEDS_SETUP", 409);
  const source = await upsertSource(definition.key);
  if (source.status !== "READY") {
    throw new PriceMonitorServiceError("SOURCE_PAUSED", 409);
  }
  const staleBoundary = new Date(Date.now() - 30 * 60 * 1000);
  await prisma.priceMonitorCrawlRun.updateMany({
    where: {
      sourceId: source.id,
      status: "RUNNING",
      startedAt: { lte: staleBoundary },
    },
    data: {
      status: "FAILED",
      errorCount: 1,
      errorMessage: "Prijsronde is afgebroken en veilig vrijgegeven voor een nieuwe poging",
      finishedAt: new Date(),
    },
  });
  const running = await prisma.priceMonitorCrawlRun.findFirst({
    where: {
      sourceId: source.id,
      status: "RUNNING",
      startedAt: { gt: staleBoundary },
    },
    select: { id: true },
  });
  if (running) throw new PriceMonitorServiceError("SOURCE_RUN_ALREADY_ACTIVE", 409);
  let run;
  try {
    run = await prisma.priceMonitorCrawlRun.create({
      data: {
        sourceId: source.id,
        requestedByAdminUserId: input.admin.id,
        requestedLimit: input.limit,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PriceMonitorServiceError("SOURCE_RUN_ALREADY_ACTIVE", 409);
    }
    throw error;
  }
  return { runId: run.id, status: "RUNNING" };
}

export async function processPriceMonitorSourceRun(input: {
  runId: string;
}): Promise<{ runId: string; status: string; successCount: number; errorCount: number }> {
  const run = await prisma.priceMonitorCrawlRun.findUnique({
    where: { id: input.runId },
    include: { source: { select: { id: true, key: true, status: true } } },
  });
  if (!run) throw new PriceMonitorServiceError("RUN_NOT_FOUND", 404);
  if (run.status !== "RUNNING") throw new PriceMonitorServiceError("RUN_ALREADY_HANDLED", 409);
  try {
    if (run.source.status !== "READY") throw new PriceMonitorServiceError("SOURCE_PAUSED", 409);
    const adapter = getPriceMonitorAdapter(run.source.key);
    if (!adapter) throw new PriceMonitorServiceError("SOURCE_NEEDS_SETUP", 409);
    const result = await adapter.run({ limit: run.requestedLimit });
    const variants = await activeVariantsForMatching();
    const qualityScores: number[] = [];
    for (const scraped of result.products) {
      const quality = assessDataQuality(scraped);
      qualityScores.push(quality.score);
      await persistScrapedProduct({
        sourceId: run.source.id,
        runId: run.id,
        scraped,
        quality,
        variants,
      });
    }
    const successCount = result.products.length;
    const errorCount = result.errors.length;
    const status = successCount === 0 ? "FAILED" : errorCount > 0 ? "PARTIAL" : "SUCCEEDED";
    await prisma.$transaction([
      prisma.priceMonitorCrawlRun.update({
        where: { id: run.id },
        data: {
          status,
          discoveredCount: result.discoveredCount,
          processedCount: successCount + errorCount,
          successCount,
          errorCount,
          dataQualityScore: qualityScores.length
            ? Math.round(qualityScores.reduce((total, score) => total + score, 0) / qualityScores.length)
            : null,
          errorMessage: result.errors[0]?.message || null,
          finishedAt: new Date(),
        },
      }),
      prisma.priceMonitorSource.update({
        where: { id: run.source.id },
        data: { lastRunAt: new Date() },
      }),
    ]);
    return { runId: run.id, status, successCount, errorCount };
  } catch (error) {
    await prisma.priceMonitorCrawlRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCount: 1,
        errorMessage: safeErrorMessage(error),
        finishedAt: new Date(),
      },
    });
    throw new PriceMonitorServiceError("SCRAPE_FAILED", 502);
  }
}

export async function completeLocalApexRun(input: {
  runId: string;
  products: ScrapedCompetitorProduct[];
}): Promise<{ runId: string; status: string; successCount: number; errorCount: number }> {
  const run = await prisma.priceMonitorCrawlRun.findUnique({
    where: { id: input.runId },
    include: { source: { select: { id: true, status: true } } },
  });
  if (!run || run.trigger !== "LOCAL_APEX") {
    throw new PriceMonitorServiceError("RUN_NOT_FOUND", 404);
  }
  if (run.status !== "RUNNING") {
    throw new PriceMonitorServiceError("RUN_ALREADY_HANDLED", 409);
  }
  if (run.source.status !== "READY") {
    throw new PriceMonitorServiceError("SOURCE_PAUSED", 409);
  }

  const variants = await activeVariantsForMatching();
  const qualityRows = input.products.map((scraped) => ({
    scraped,
    quality: assessDataQuality(scraped),
  }));
  const successCount = input.products.length;
  const status = successCount > 0 ? "SUCCEEDED" : "FAILED";

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.priceMonitorCrawlRun.updateMany({
        where: { id: run.id, status: "RUNNING" },
        data: { status: "PARTIAL" },
      });
      if (claimed.count !== 1) {
        throw new PriceMonitorServiceError("RUN_ALREADY_HANDLED", 409);
      }
      for (const row of qualityRows) {
        await persistScrapedProductWithTx(tx, {
          sourceId: run.source.id,
          runId: run.id,
          scraped: row.scraped,
          quality: row.quality,
          variants,
        });
      }
      await tx.priceMonitorCrawlRun.update({
        where: { id: run.id },
        data: {
          status,
          discoveredCount: successCount,
          processedCount: successCount,
          successCount,
          errorCount: successCount > 0 ? 0 : 1,
          dataQualityScore: qualityRows.length
            ? Math.round(qualityRows.reduce((total, row) => total + row.quality.score, 0) / qualityRows.length)
            : null,
          errorMessage: successCount > 0 ? null : "De lokale APEX-run bevatte geen geldige prijsregels",
          finishedAt: new Date(),
        },
      });
      await tx.priceMonitorSource.update({
        where: { id: run.source.id },
        data: { lastRunAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { runId: run.id, status, successCount, errorCount: successCount > 0 ? 0 : 1 };
  } catch (error) {
    await prisma.priceMonitorCrawlRun.updateMany({
      where: { id: run.id, status: "RUNNING" },
      data: {
        status: "FAILED",
        errorCount: 1,
        errorMessage: safeErrorMessage(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function reviewPriceMonitorMatch(input: {
  matchId: string;
  decision: "APPROVE" | "REJECT";
  admin: AdminUser;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.priceMonitorMatch.findUnique({
      where: { id: input.matchId },
      include: {
        productVariant: true,
        competitorProduct: {
          include: { observations: { orderBy: { observedAt: "desc" }, take: 1 } },
        },
      },
    });
    if (!current) throw new PriceMonitorServiceError("MATCH_NOT_FOUND", 404);
    const status: PriceMonitorMatchStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const updated = await tx.priceMonitorMatch.update({
      where: { id: current.id },
      data: {
        status,
        approvedAt: status === "APPROVED" ? new Date() : null,
        rejectedAt: status === "REJECTED" ? new Date() : null,
      },
    });
    await recordAudit(
      tx,
      input.admin,
      "PriceMonitorMatch",
      current.id,
      "UPDATE",
      { status: current.status },
      { status: updated.status }
    );
    if (status === "APPROVED") {
      const observation = current.competitorProduct.observations[0];
      if (observation) await upsertRecommendation(tx, current, observation);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applyPriceMonitorRecommendation(input: {
  recommendationId: string;
  expectedCurrentPriceCents: number;
  targetPriceCents: number;
  marginChecked: boolean;
  admin: AdminUser;
}): Promise<{ productId: string; variantId: string; before: number; after: number }> {
  return prisma.$transaction(async (tx) => {
    const recommendation = await tx.pricingRecommendation.findUnique({
      where: { id: input.recommendationId },
      include: {
        productVariant: {
          include: {
            product: { select: { basePriceCents: true, salePriceCents: true, isActive: true } },
          },
        },
        match: true,
        observation: { select: { observedAt: true, qualityFlags: true, dataQualityScore: true } },
      },
    });
    if (!recommendation) throw new PriceMonitorServiceError("RECOMMENDATION_NOT_FOUND", 404);
    if (recommendation.match.status !== "APPROVED") {
      throw new PriceMonitorServiceError("MATCH_NOT_APPROVED", 409);
    }
    if (
      recommendation.status !== PriceMonitorRecommendationStatus.OPEN &&
      recommendation.status !== PriceMonitorRecommendationStatus.APPROVED
    ) {
      throw new PriceMonitorServiceError("RECOMMENDATION_ALREADY_HANDLED", 409);
    }
    if (recommendation.type !== "LOWER" && recommendation.type !== "RAISE") {
      throw new PriceMonitorServiceError("RECOMMENDATION_NOT_ACTIONABLE", 409);
    }
    if (
      Date.now() - recommendation.observation.observedAt.getTime() >
      PRICE_MONITOR_OBSERVATION_MAX_AGE_MS
    ) {
      throw new PriceMonitorServiceError("STALE_OBSERVATION", 409);
    }
    if (
      recommendation.observation.dataQualityScore < 75 ||
      recommendation.observation.qualityFlags.some((flag) =>
        [
          "OUT_OF_STOCK",
          "COMPETITOR_PROMOTION",
          "UNVERIFIED_PRICE_SOURCE",
          "SUSPECT_OUTLIER",
          "MISSING_PACKAGE",
          "UNSUPPORTED_CURRENCY",
        ].includes(flag)
      )
    ) {
      throw new PriceMonitorServiceError("UNSAFE_SOURCE_DATA", 409);
    }
    if (
      recommendation.productVariant.salePriceCents !== null ||
      recommendation.productVariant.product.salePriceCents !== null
    ) {
      throw new PriceMonitorServiceError("ACTIVE_SALE_PRICE", 409);
    }
    if (!recommendation.productVariant.isActive || !recommendation.productVariant.product.isActive) {
      throw new PriceMonitorServiceError("INACTIVE_PRODUCT", 409);
    }
    if (recommendation.currentPriceCents !== recommendation.productVariant.priceCents) {
      throw new PriceMonitorServiceError("RECOMMENDATION_STALE_BASELINE", 409);
    }
    const validation = validatePriceAction({
      currentPriceCents: recommendation.productVariant.priceCents,
      expectedCurrentPriceCents: input.expectedCurrentPriceCents,
      targetPriceCents: input.targetPriceCents,
      marginChecked: input.marginChecked,
    });
    if (!validation.ok) throw new PriceMonitorServiceError(validation.error, 409);

    await tx.productVariant.update({
      where: { id: recommendation.productVariantId },
      data: { priceCents: input.targetPriceCents },
    });
    const prices = await tx.productVariant.findMany({
      where: { productId: recommendation.productVariant.productId, isActive: true },
      select: { priceCents: true },
    });
    const nextBasePriceCents = prices.length
      ? Math.min(...prices.map((price) => price.priceCents))
      : recommendation.productVariant.product.basePriceCents;
    if (prices.length) {
      await tx.product.update({
        where: { id: recommendation.productVariant.productId },
        data: { basePriceCents: nextBasePriceCents },
      });
    }
    await tx.pricingRecommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "APPLIED",
        reviewedByAdminUserId: input.admin.id,
        reviewedAt: new Date(),
        appliedByAdminUserId: input.admin.id,
        appliedAt: new Date(),
        appliedPriceCents: input.targetPriceCents,
      },
    });
    await tx.pricingRecommendation.updateMany({
      where: {
        productVariantId: recommendation.productVariantId,
        id: { not: recommendation.id },
        status: { in: ["OPEN", "APPROVED"] },
      },
      data: {
        status: "DISMISSED",
        failureReason: "VERVALLEN_NA_PRIJSWIJZIGING",
      },
    });
    await recordAudit(
      tx,
      input.admin,
      "PriceMonitorPriceAction",
      recommendation.id,
      "UPDATE",
      {
        productId: recommendation.productVariant.productId,
        productVariantId: recommendation.productVariantId,
        variantPriceCents: recommendation.productVariant.priceCents,
        productBasePriceCents: recommendation.productVariant.product.basePriceCents,
      },
      {
        productId: recommendation.productVariant.productId,
        productVariantId: recommendation.productVariantId,
        variantPriceCents: input.targetPriceCents,
        productBasePriceCents: nextBasePriceCents,
        observationId: recommendation.observationId,
        rulesVersion: recommendation.rulesVersion,
      }
    );
    return {
      productId: recommendation.productVariant.productId,
      variantId: recommendation.productVariantId,
      before: recommendation.productVariant.priceCents,
      after: input.targetPriceCents,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function savePriceMonitorSchedule(input: {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  hourLocal: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipientEmail: string;
  formats: string[];
  minDifferencePercent: number;
  admin: AdminUser;
}): Promise<void> {
  const current = await prisma.priceMonitorReportSchedule.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = {
    name: "Standaard prijsrapport",
    enabled: input.enabled,
    frequency: input.frequency,
    hourLocal: input.hourLocal,
    dayOfWeek: input.frequency === "WEEKLY" ? input.dayOfWeek : null,
    dayOfMonth: input.frequency === "MONTHLY" ? input.dayOfMonth : null,
    recipientEmail: input.recipientEmail || null,
    formats: input.formats,
    minDifferenceBps: Math.round(input.minDifferencePercent * 100),
    nextRunAt: input.enabled ? nextPriceReportRun(new Date(), input) : null,
  };
  if (current) {
    await prisma.priceMonitorReportSchedule.update({ where: { id: current.id }, data });
  } else {
    await prisma.priceMonitorReportSchedule.create({
      data: { ...data, createdByAdminUserId: input.admin.id },
    });
  }
}

async function upsertSource(key: string) {
  const definition = getPriceMonitorSource(key);
  if (!definition) throw new PriceMonitorServiceError("SOURCE_NOT_FOUND", 404);
  return prisma.priceMonitorSource.upsert({
    where: { key: definition.key },
    update: {
      name: definition.name,
      baseUrl: definition.baseUrl,
      adapterKey: definition.adapterKey,
      statusNote: definition.statusNote,
    },
    create: {
      key: definition.key,
      name: definition.name,
      baseUrl: definition.baseUrl,
      adapterKey: definition.adapterKey,
      status: definition.status,
      statusNote: definition.statusNote,
    },
  });
}

async function persistScrapedProduct(input: {
  sourceId: string;
  runId: string;
  scraped: ScrapedCompetitorProduct;
  quality: ReturnType<typeof assessDataQuality>;
  variants: Awaited<ReturnType<typeof activeVariantsForMatching>>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => persistScrapedProductWithTx(tx, input));
}

async function persistScrapedProductWithTx(
  tx: Prisma.TransactionClient,
  input: {
    sourceId: string;
    runId: string;
    scraped: ScrapedCompetitorProduct;
    quality: ReturnType<typeof assessDataQuality>;
    variants: Awaited<ReturnType<typeof activeVariantsForMatching>>;
  }
): Promise<void> {
  const currentByUrl = await tx.priceMonitorCompetitorProduct.findUnique({
    where: { sourceId_sourceUrl: { sourceId: input.sourceId, sourceUrl: input.scraped.sourceUrl } },
  });
  const currentByStableKey = !currentByUrl && input.scraped.sourceKey.startsWith("apex-local-") && input.scraped.externalKey
    ? await tx.priceMonitorCompetitorProduct.findFirst({
        where: { sourceId: input.sourceId, externalKey: input.scraped.externalKey },
        orderBy: { lastSeenAt: "desc" },
      })
    : null;
  const currentProduct = currentByUrl || currentByStableKey;
  const product = currentProduct
    ? await tx.priceMonitorCompetitorProduct.update({
        where: { id: currentProduct.id },
        data: {
          sourceUrl: input.scraped.sourceUrl,
          ...competitorProductData(input.scraped),
        },
      })
    : await tx.priceMonitorCompetitorProduct.create({
        data: {
          sourceId: input.sourceId,
          sourceUrl: input.scraped.sourceUrl,
          ...competitorProductData(input.scraped),
        },
      });
  const normalized = normalizePrice(
    input.scraped.priceCents,
    input.scraped.packageQuantity,
    input.scraped.packageUnit
  );
  if (!input.scraped.priceCents) return;
  const observation = await tx.priceMonitorObservation.create({
    data: {
      crawlRunId: input.runId,
      competitorProductId: product.id,
      priceCents: input.scraped.priceCents,
      currency: input.scraped.currency,
      normalizedPriceCents: normalized.normalizedPriceCents,
      normalizedUnit: normalized.normalizedUnit,
      dataQualityScore: input.quality.score,
      qualityFlags: input.quality.flags,
      inStock: input.scraped.inStock,
    },
  });
  const best = input.variants
    .map((variant) => ({
      variant,
      match: scoreProductMatch({
        variantId: variant.id,
        ownSku: variant.sku,
        ownName: `${variant.product.translations[0]?.name || variant.product.slug} ${variant.weightGrams} gram`,
        ownWeightGrams: variant.weightGrams,
        competitorSku: input.scraped.sku,
        competitorEan: input.scraped.ean,
        competitorName: input.scraped.name,
        competitorQuantity: input.scraped.packageQuantity,
        competitorUnit: input.scraped.packageUnit,
      }),
    }))
    .sort((a, b) => b.match.score - a.match.score)[0];
  if (!best || best.match.score < 55) return;
  const match = await tx.priceMonitorMatch.upsert({
    where: {
      productVariantId_competitorProductId: {
        productVariantId: best.variant.id,
        competitorProductId: product.id,
      },
    },
    update: { confidenceScore: best.match.score, reason: best.match.reason },
    create: {
      productVariantId: best.variant.id,
      competitorProductId: product.id,
      confidenceScore: best.match.score,
      reason: best.match.reason,
    },
  });
  if (match.status === "APPROVED") {
    await upsertRecommendation(tx, { ...match, productVariant: best.variant }, observation);
  }
}

function activeVariantsForMatching() {
  return prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    include: { product: { include: { translations: { where: { locale: "nl" }, take: 1 } } } },
  });
}

async function upsertRecommendation(
  tx: Prisma.TransactionClient,
  match: {
    id: string;
    confidenceScore: number;
    productVariant: { id: string; priceCents: number; salePriceCents: number | null; weightGrams: number };
  },
  observation: {
    id: string;
    normalizedPriceCents: number | null;
    normalizedUnit: string | null;
    dataQualityScore: number;
    qualityFlags: string[];
  }
): Promise<void> {
  const currentPriceCents = match.productVariant.salePriceCents ?? match.productVariant.priceCents;
  const result = buildPriceRecommendation({
    currentPriceCents,
    ownWeightGrams: match.productVariant.weightGrams,
    competitorNormalizedPriceCents: observation.normalizedPriceCents,
    competitorNormalizedUnit:
      observation.normalizedUnit === "KILOGRAM" ||
      observation.normalizedUnit === "LITER" ||
      observation.normalizedUnit === "PIECE"
        ? observation.normalizedUnit
        : null,
    matchConfidenceScore: match.confidenceScore,
    dataQualityScore: observation.dataQualityScore,
    qualityFlags: observation.qualityFlags as PriceMonitorQualityFlag[],
  });
  const latest = await tx.pricingRecommendation.upsert({
    where: {
      productVariantId_observationId: {
        productVariantId: match.productVariant.id,
        observationId: observation.id,
      },
    },
    update: recommendationData(result),
    create: {
      productVariantId: match.productVariant.id,
      matchId: match.id,
      observationId: observation.id,
      ...recommendationData(result),
    },
  });
  await tx.pricingRecommendation.updateMany({
    where: {
      productVariantId: match.productVariant.id,
      id: { not: latest.id },
      status: { in: ["OPEN", "APPROVED"] },
    },
    data: {
      status: "DISMISSED",
      failureReason: "VERVANGEN_DOOR_NIEUWSTE_METING",
    },
  });
}

function recommendationData(result: ReturnType<typeof buildPriceRecommendation>) {
  return {
    type: result.type,
    status: "OPEN" as const,
    currentPriceCents: result.currentPriceCents,
    competitorPriceCents: result.competitorEquivalentPriceCents,
    suggestedPriceCents: result.suggestedPriceCents,
    differenceBps: result.differenceBps,
    scenarioImpactPer100Cents: result.scenarioImpactPer100Cents,
    confidenceScore: result.confidenceScore,
    rationale: result.rationale,
    caveat: result.caveat,
    rulesVersion: PRICE_COACH_RULES_VERSION,
  };
}

function competitorProductData(scraped: ScrapedCompetitorProduct) {
  return {
    externalKey: scraped.externalKey,
    canonicalName: scraped.name,
    description: scraped.description,
    sku: scraped.sku,
    ean: scraped.ean,
    packageQuantity: scraped.packageQuantity,
    packageUnit: scraped.packageUnit,
    currency: scraped.currency,
    inStock: scraped.inStock,
    raw: scraped.raw ? (scraped.raw as Prisma.InputJsonValue) : Prisma.JsonNull,
    lastSeenAt: new Date(),
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Onbekende fout tijdens de prijsronde";
}
