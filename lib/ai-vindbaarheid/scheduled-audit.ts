import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLocales } from "@/lib/product-audit-core";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { runBatchAudit } from "@/lib/ai-vindbaarheid/batch-audit";

const STATE_ID = "catalogue";
const PAGE_SIZE = 6;
const LEASE_MS = 180_000;
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type ScheduledAuditTick =
  | { status: "busy" | "not_due" }
  | { status: "running" | "completed"; runId: string; scannedProducts: number; totalProducts: number; pagesChecked: number; issueCount: number };

/** Cron performs at most six products per invocation and persists its cursor.
 * Do not call from a regular storefront request.
 */
export async function runScheduledGeoAudit(now = new Date()): Promise<ScheduledAuditTick> {
  await prisma.geoAuditScheduler.upsert({
    where: { id: STATE_ID },
    create: { id: STATE_ID, nextDueAt: now },
    update: {},
  });
  const owner = randomUUID();
  const lease = await prisma.geoAuditScheduler.updateMany({
    where: { id: STATE_ID, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (!lease.count) return { status: "busy" };

  let runId: string | null = null;
  try {
    const state = await prisma.geoAuditScheduler.findUniqueOrThrow({ where: { id: STATE_ID } });
    runId = state.activeRunId;
    if (!runId) {
      if (state.nextDueAt > now) return { status: "not_due" };
      const totalProducts = await prisma.product.count({ where: { isActive: true } });
      const run = await prisma.geoAuditRun.create({
        data: { status: "RUNNING", trigger: "SCHEDULED", totalProducts },
      });
      runId = run.id;
      await prisma.geoAuditScheduler.update({
        where: { id: STATE_ID },
        data: { activeRunId: runId },
      });
    }
    const run = await prisma.geoAuditRun.findUniqueOrThrow({ where: { id: runId } });
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(run.cursor ? { id: { gt: run.cursor } } : {}) },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        sku: true,
        translations: { select: { locale: true, name: true, slug: true } },
      },
    });
    const results = await runBatchAudit(products.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.translations.find((translation) => translation.locale === "nl")?.name ?? item.sku,
      targets: item.translations
        .filter((translation) => auditLocales.includes(translation.locale) &&
          translation.name.trim() && translation.slug.trim())
        .map((translation) => ({
          locale: translation.locale,
          path: productPath(translation.locale, translation.slug),
          productName: translation.name,
        })),
    })), { baseUrl: BASE_URL, concurrency: 2 });

    const countPages = results.reduce((sum, result) => sum + result.pages.length, 0);
    const countIssues = results.reduce((sum, result) => sum + result.findings.length, 0);
    const finished = products.length < PAGE_SIZE;
    const lastCursor = products.at(-1)?.id ?? run.cursor;

    const updated = await prisma.$transaction(async (tx) => {
      // A worker whose lease expired may not commit snapshots or advance the cursor.
      const stillOwner = await tx.geoAuditScheduler.updateMany({
        where: { id: STATE_ID, leaseOwner: owner, leaseUntil: { gt: new Date() } },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
      if (!stillOwner.count) throw new Error("GEO_AUDIT_LEASE_LOST");
      for (const result of results) {
        for (const page of result.pages) {
          await tx.geoAuditPage.upsert({
            where: { runId_productId_locale: { runId: runId!, productId: result.id, locale: page.locale } },
            create: {
              runId: runId!, productId: result.id, sku: result.sku, locale: page.locale,
              url: page.url, httpStatus: page.status, score: page.score,
              checks: page.checks as unknown as Prisma.InputJsonValue,
              findings: result.findings.filter((finding) => finding.locale === page.locale) as unknown as Prisma.InputJsonValue,
            },
            update: {
              url: page.url, httpStatus: page.status, score: page.score,
              checks: page.checks as unknown as Prisma.InputJsonValue,
              findings: result.findings.filter((finding) => finding.locale === page.locale) as unknown as Prisma.InputJsonValue,
              checkedAt: new Date(),
            },
          });
        }
      }
      const updatedRun = await tx.geoAuditRun.update({
        where: { id: runId! },
        data: {
          cursor: lastCursor,
          scannedProducts: { increment: products.length },
          pagesChecked: { increment: countPages },
          issueCount: { increment: countIssues },
          lastError: null,
          ...(finished ? { status: "COMPLETED", completedAt: new Date() } : {}),
        },
      });
      if (finished) {
        await tx.geoAuditScheduler.update({
          where: { id: STATE_ID },
          data: {
            activeRunId: null,
            nextDueAt: new Date(now.getTime() + INTERVAL_MS),
          },
        });
      }
      return updatedRun;
    });
    return {
      status: finished ? "completed" : "running",
      runId: updated.id,
      scannedProducts: updated.scannedProducts,
      totalProducts: updated.totalProducts,
      pagesChecked: updated.pagesChecked,
      issueCount: updated.issueCount,
    };
  } catch (error) {
    if (runId) {
      await prisma.geoAuditRun.update({
        where: { id: runId },
        data: { lastError: error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR" },
      }).catch((logError: unknown) => console.error("Unable to log GEO audit failure", logError));
    }
    throw error;
  } finally {
    await prisma.geoAuditScheduler.updateMany({
      where: { id: STATE_ID, leaseOwner: owner },
      data: { leaseOwner: null, leaseUntil: null },
    });
  }
}
