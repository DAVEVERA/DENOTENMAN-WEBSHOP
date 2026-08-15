import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { createPausedProductAd, googleAdsConfigurationState, setProductAdStatus } from "@/lib/google-ads";
import { prisma } from "@/lib/prisma";

const saveSchema = z.object({
  action: z.literal("save"), productId: z.string().cuid(),
  headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
  finalUrl: z.string().url().refine((value) => value.startsWith("https://denotenman.com/"), "Alleen denotenman.com is toegestaan"),
  dailyBudgetMicros: z.number().int().min(1_000_000).max(2_000_000_000),
});
const actionSchema = z.object({ action: z.enum(["publish", "enable", "pause"]), productId: z.string().cuid() });

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const saved = saveSchema.safeParse(body);
  if (saved.success) {
    await prisma.googleAdsConfiguration.upsert({
      where: { productId: saved.data.productId },
      update: { headlines: saved.data.headlines, descriptions: saved.data.descriptions, finalUrl: saved.data.finalUrl, dailyBudgetMicros: saved.data.dailyBudgetMicros, status: "DRAFT", enabled: false, lastError: null },
      create: { productId: saved.data.productId, headlines: saved.data.headlines, descriptions: saved.data.descriptions, finalUrl: saved.data.finalUrl, dailyBudgetMicros: saved.data.dailyBudgetMicros },
    });
    return NextResponse.json({ ok: true });
  }
  const action = actionSchema.safeParse(body);
  if (!action.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const config = await prisma.googleAdsConfiguration.findUnique({ where: { productId: action.data.productId }, include: { product: { include: { translations: { where: { locale: "nl" } } } } } });
  if (!config) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const state = googleAdsConfigurationState();
  if (!state.configured) return NextResponse.json({ error: "GOOGLE_ADS_CONFIG_MISSING", missing: state.missing }, { status: 503 });

  try {
    if (action.data.action === "publish") {
      if (!config.finalUrl || !config.dailyBudgetMicros || config.headlines.length < 3 || config.descriptions.length < 2) return NextResponse.json({ error: "INCOMPLETE_DRAFT" }, { status: 409 });
      if (config.adResourceName) return NextResponse.json({ error: "ALREADY_PUBLISHED" }, { status: 409 });
      const resources = await createPausedProductAd({ name: config.product.translations[0]?.name ?? config.product.slug, headlines: config.headlines, descriptions: config.descriptions, finalUrl: config.finalUrl, dailyBudgetMicros: config.dailyBudgetMicros });
      await prisma.googleAdsConfiguration.update({ where: { productId: action.data.productId }, data: { campaignResourceName: resources.campaign, adGroupResourceName: resources.adGroup, adResourceName: resources.ad, status: "PAUSED", enabled: false, lastSyncedAt: new Date(), lastError: null } });
    } else {
      if (!config.adResourceName) return NextResponse.json({ error: "NOT_PUBLISHED" }, { status: 409 });
      const enabled = action.data.action === "enable";
      await setProductAdStatus(config.adResourceName, enabled);
      await prisma.googleAdsConfiguration.update({ where: { productId: action.data.productId }, data: { enabled, status: enabled ? "ENABLED" : "PAUSED", lastSyncedAt: new Date(), lastError: null } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown Google Ads error";
    await prisma.googleAdsConfiguration.update({ where: { productId: action.data.productId }, data: { status: "ERROR", enabled: false, lastError: message } });
    console.error(`Google Ads action failed for ${action.data.productId}`, error);
    return NextResponse.json({ error: "GOOGLE_ADS_FAILED" }, { status: 502 });
  }
}
