import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type AdminUser } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApexScanSummary } from "@/lib/price-monitor/apex-scan";
import {
  completeLocalApexRun,
  PriceMonitorServiceError,
} from "@/lib/price-monitor/service";
import type {
  PriceMonitorApexLocalRunView,
  PriceMonitorApexLocalSession,
  ScrapedCompetitorProduct,
} from "@/lib/price-monitor/types";

const LOCAL_RUN_TTL_MS = 30 * 60 * 1000;
const MAX_UPLOAD_PRODUCTS = 25;
const MAX_UPLOAD_VARIANTS = 50;

const numberLike = z.union([
  z.number().finite(),
  z.string().trim().max(40),
  z.null(),
]).optional();

const apexVariantSchema = z.object({
  title: z.string().trim().max(300).optional(),
  price: numberLike,
  compare_price: numberLike,
  sku: z.string().trim().max(200).nullable().optional(),
  unit: z.string().trim().max(100).nullable().optional(),
  unit_price: numberLike,
});

const apexProductSchema = z.object({
  url: z.string().trim().max(2_048),
  name: z.string().trim().min(1).max(500),
  price: numberLike,
  variants: z.array(apexVariantSchema).max(MAX_UPLOAD_VARIANTS).optional(),
  description: z.string().trim().max(10_000).optional(),
  sku: z.string().trim().max(200).nullable().optional(),
});

export const apexLocalUploadSchema = z.object({
  domain: z.string().trim().toLowerCase().min(4).max(120),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  products: z.array(apexProductSchema).max(MAX_UPLOAD_PRODUCTS),
});

type ApexUpload = z.infer<typeof apexLocalUploadSchema>;
type ApexVariant = z.infer<typeof apexVariantSchema>;

type LocalTokenPayload = {
  runId: string;
  domain: string;
  exp: number;
};

export function isAllowedLocalApexDomain(domain: string): boolean {
  const normalized = domain.trim().toLocaleLowerCase("en-US");
  return normalized.includes(".") && getApexScanSummary().sources.some(
    (source) => source.domain === normalized
  );
}

export async function createApexLocalSession(input: {
  domain: string;
  limit: number;
  admin: AdminUser;
}): Promise<PriceMonitorApexLocalSession> {
  const domain = input.domain.trim().toLocaleLowerCase("en-US");
  if (!isAllowedLocalApexDomain(domain)) {
    throw new PriceMonitorServiceError("APEX_DOMAIN_NOT_ALLOWED", 400);
  }
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_UPLOAD_PRODUCTS) {
    throw new PriceMonitorServiceError("VALIDATION_ERROR", 400);
  }

  const sourceKey = localSourceKey(domain);
  const source = await prisma.priceMonitorSource.upsert({
    where: { key: sourceKey },
    update: {
      name: domain,
      baseUrl: `https://${domain}`,
      adapterKey: "apex-local-v1",
      status: "READY",
      statusNote: "Gratis lokaal uitgevoerd en automatisch ingelezen",
    },
    create: {
      key: sourceKey,
      name: domain,
      baseUrl: `https://${domain}`,
      adapterKey: "apex-local-v1",
      status: "READY",
      statusNote: "Gratis lokaal uitgevoerd en automatisch ingelezen",
    },
  });

  const staleBoundary = new Date(Date.now() - LOCAL_RUN_TTL_MS);
  await prisma.priceMonitorCrawlRun.updateMany({
    where: { sourceId: source.id, status: "RUNNING", startedAt: { lte: staleBoundary } },
    data: {
      status: "FAILED",
      errorCount: 1,
      errorMessage: "Lokale APEX-opdracht is verlopen zonder resultaat",
      finishedAt: new Date(),
    },
  });

  const running = await prisma.priceMonitorCrawlRun.findFirst({
    where: { sourceId: source.id, status: "RUNNING", startedAt: { gt: staleBoundary } },
    select: { id: true },
  });
  if (running) throw new PriceMonitorServiceError("APEX_RUN_ALREADY_ACTIVE", 409);

  let run;
  try {
    run = await prisma.priceMonitorCrawlRun.create({
      data: {
        sourceId: source.id,
        requestedByAdminUserId: input.admin.id,
        requestedLimit: input.limit,
        trigger: "LOCAL_APEX",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PriceMonitorServiceError("APEX_RUN_ALREADY_ACTIVE", 409);
    }
    throw error;
  }

  const expiresAt = Date.now() + LOCAL_RUN_TTL_MS;
  return {
    runId: run.id,
    uploadToken: signLocalToken({ runId: run.id, domain, exp: expiresAt }),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function getApexLocalRunView(input: {
  runId: string;
  adminId: string;
}): Promise<PriceMonitorApexLocalRunView> {
  const run = await prisma.priceMonitorCrawlRun.findFirst({
    where: { id: input.runId, requestedByAdminUserId: input.adminId, trigger: "LOCAL_APEX" },
    include: {
      source: true,
      observations: {
        orderBy: { observedAt: "desc" },
        take: 10,
        include: { competitorProduct: true },
      },
    },
  });
  if (!run) throw new PriceMonitorServiceError("RUN_NOT_FOUND", 404);
  const domain = new URL(run.source.baseUrl).hostname.toLocaleLowerCase("en-US");
  const complete = run.status === "SUCCEEDED" || run.status === "PARTIAL";
  return {
    runId: run.id,
    domain,
    status: run.status,
    message: run.status === "RUNNING"
      ? "De prijsmonitor wacht op de gratis lokale APEX-run."
      : complete
        ? "De nieuwste lokale meting is automatisch ingelezen. Eerdere productregels zijn bijgewerkt; prijshistorie blijft bewaard."
        : run.errorMessage || "De lokale APEX-run leverde geen bruikbaar resultaat op.",
    result: complete ? {
      execution: run.id,
      domain,
      capturedAt: (run.finishedAt || run.startedAt).toISOString(),
      productCount: run.successCount,
      priceRowCount: run.processedCount,
      resultObject: "Automatisch ingelezen vanaf de computer van de beheerder",
      preview: run.observations.map((observation) => ({
        domain,
        productName: observation.competitorProduct.canonicalName,
        variantName: observation.competitorProduct.packageQuantity && observation.competitorProduct.packageUnit
          ? `${observation.competitorProduct.packageQuantity} ${packageUnitLabel(observation.competitorProduct.packageUnit)}`
          : "Eenheid controleren",
        productUrl: observation.competitorProduct.sourceUrl,
        priceCents: observation.priceCents,
        sku: observation.competitorProduct.sku,
      })),
    } : null,
  };
}

export async function acceptApexLocalUpload(input: {
  runId: string;
  token: string;
  upload: ApexUpload;
}) {
  const token = verifyLocalToken(input.token);
  if (!token || token.runId !== input.runId || token.domain !== input.upload.domain) {
    throw new PriceMonitorServiceError("APEX_UPLOAD_TOKEN_INVALID", 401);
  }
  const run = await prisma.priceMonitorCrawlRun.findUnique({
    where: { id: input.runId },
    include: { source: true },
  });
  if (!run || run.trigger !== "LOCAL_APEX") {
    throw new PriceMonitorServiceError("RUN_NOT_FOUND", 404);
  }
  const runDomain = new URL(run.source.baseUrl).hostname.toLocaleLowerCase("en-US");
  if (runDomain !== token.domain || run.requestedLimit < input.upload.products.length) {
    throw new PriceMonitorServiceError("APEX_UPLOAD_MISMATCH", 409);
  }
  const products = toScrapedProducts(input.upload, run.source.key);
  return completeLocalApexRun({ runId: run.id, products });
}

function signLocalToken(payload: LocalTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${tokenSignature(encoded)}`;
}

function verifyLocalToken(token: string): LocalTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = tokenSignature(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as LocalTokenPayload;
    if (
      typeof payload.runId !== "string" ||
      typeof payload.domain !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      !isAllowedLocalApexDomain(payload.domain)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

function tokenSignature(encoded: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function toScrapedProducts(upload: ApexUpload, sourceKey: string): ScrapedCompetitorProduct[] {
  return upload.products.flatMap((product) => {
    const trustedUrl = trustedProductUrl(product.url, upload.domain);
    if (!trustedUrl) return [];
    const variants: ApexVariant[] = product.variants?.length
      ? product.variants
      : [{ title: "Standaard", price: product.price }];
    return variants.flatMap((variant, index) => {
      const priceCents = moneyCents(variant.price ?? product.price);
      if (priceCents === null) return [];
      const comparePriceCents = moneyCents(variant.compare_price);
      const packageInfo = parsePackage(
        `${variant.unit || ""} ${variant.title || ""} ${product.name} ${product.description || ""}`,
        priceCents,
        moneyCents(variant.unit_price)
      );
      const identity = localVariantIdentity({
        sku: variant.sku || product.sku,
        unit: variant.unit,
        title: variant.title,
        index,
      });
      const sourceUrl = withVariantIdentity(trustedUrl, identity, variants.length > 1);
      const stableSku = (variant.sku || product.sku)?.trim().toLocaleLowerCase("en-US");
      return [{
        sourceKey,
        sourceUrl,
        externalKey: stableSku ? `sku:${stableSku}` : `url:${trustedUrl}|${identity}`,
        name: [product.name, variant.title && variant.title !== "Standaard" ? variant.title : ""]
          .filter(Boolean)
          .join(" · "),
        description: product.description || null,
        sku: variant.sku || product.sku || null,
        ean: null,
        priceCents,
        currency: "EUR",
        packageQuantity: packageInfo.quantity,
        packageUnit: packageInfo.unit,
        inStock: null,
        isPromotionalPrice: comparePriceCents !== null && comparePriceCents > priceCents,
        priceSource: "VISIBLE_FALLBACK",
        raw: { product, variant, capturedAt: upload.capturedAt || null },
      } satisfies ScrapedCompetitorProduct];
    });
  });
}

function parsePackage(
  text: string,
  priceCents: number,
  unitPriceCents: number | null
): { quantity: number | null; unit: "GRAM" | "MILLILITER" | "PIECE" | null } {
  const match = text.toLocaleLowerCase("nl-NL").match(
    /(\d+(?:[.,]\d+)?)\s*(kilogram|kilo|kg|gram|gr|g|milliliter|ml|liter|litre|l|stuks?|pieces?)/i
  );
  if (match) {
    const amount = Number(match[1].replace(",", "."));
    const unit = match[2].toLowerCase();
    if (Number.isFinite(amount) && amount > 0) {
      if (["kilogram", "kilo", "kg"].includes(unit)) return { quantity: Math.round(amount * 1000), unit: "GRAM" };
      if (["gram", "gr", "g"].includes(unit)) return { quantity: Math.round(amount), unit: "GRAM" };
      if (["liter", "litre", "l"].includes(unit)) return { quantity: Math.round(amount * 1000), unit: "MILLILITER" };
      if (["milliliter", "ml"].includes(unit)) return { quantity: Math.round(amount), unit: "MILLILITER" };
      return { quantity: Math.round(amount), unit: "PIECE" };
    }
  }
  if (unitPriceCents && unitPriceCents > 0) {
    const derivedGrams = Math.round((priceCents * 1000) / unitPriceCents);
    if (derivedGrams >= 1 && derivedGrams <= 100_000) {
      return { quantity: derivedGrams, unit: "GRAM" };
    }
  }
  return { quantity: null, unit: null };
}

function moneyCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function trustedProductUrl(value: string, domain: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (hostname !== domain && !hostname.endsWith(`.${domain}`))
    ) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function withVariantIdentity(urlValue: string, identity: string, multiple: boolean): string {
  if (!multiple && identity === "standaard") return urlValue;
  const url = new URL(urlValue);
  url.hash = `apex-${identity}`;
  return url.toString();
}

function localVariantIdentity(input: {
  sku?: string | null;
  unit?: string | null;
  title?: string;
  index: number;
}): string {
  const value = input.sku || input.unit || input.title || `variant-${input.index + 1}`;
  return value.toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "standaard";
}

function localSourceKey(domain: string): string {
  return `apex-local-${domain.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function packageUnitLabel(unit: string): string {
  if (unit === "GRAM") return "gram";
  if (unit === "MILLILITER") return "ml";
  return "stuks";
}
