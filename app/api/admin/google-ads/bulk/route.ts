import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { googleAdsConfigurationState, setProductAdStatus } from "@/lib/google-ads";

const schema = z.object({ categoryId: z.string().cuid(), action: z.enum(["create-drafts", "enable", "pause"]) });

export async function POST(request: NextRequest) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const products = await prisma.product.findMany({
    where: { isActive: true, productCategories: { some: { categoryId: parsed.data.categoryId } } },
    include: { translations: { where: { locale: "nl" } }, googleAdsConfiguration: true },
  });
  if (parsed.data.action !== "create-drafts") {
    const state = googleAdsConfigurationState();
    if (!state.configured) return NextResponse.json({ error: "GOOGLE_ADS_CONFIG_MISSING", missing: state.missing }, { status: 503 });
    const enabled = parsed.data.action === "enable";
    const errors: string[] = [];
    let processed = 0;
    for (const product of products) {
      const config = product.googleAdsConfiguration;
      if (!config?.adResourceName) continue;
      try {
        await setProductAdStatus(config.adResourceName, enabled);
        await prisma.googleAdsConfiguration.update({ where: { productId: product.id }, data: { enabled, status: enabled ? "ENABLED" : "PAUSED", lastSyncedAt: new Date(), lastError: null } });
        processed += 1;
      } catch (error) {
        errors.push(product.id);
        await prisma.googleAdsConfiguration.update({ where: { productId: product.id }, data: { status: "ERROR", enabled: false, lastError: error instanceof Error ? error.message.slice(0, 1000) : "Bulk status update failed" } });
      }
    }
    return NextResponse.json({ ok: errors.length === 0, count: processed, failed: errors.length }, { status: errors.length ? 207 : 200 });
  }
  for (const product of products) {
    const name = product.translations[0]?.name ?? product.slug;
    await prisma.googleAdsConfiguration.upsert({
      where: { productId: product.id }, update: {},
      create: { productId: product.id, headlines: [name.slice(0, 30), "Vers van De Notenman", "Bestel eenvoudig online"], descriptions: [`Ontdek ${name}. Vers verpakt en eenvoudig online besteld.`.slice(0, 90), "Bekijk het assortiment van De Notenman en bestel veilig online."], finalUrl: `https://denotenman.com/nl/producten/${product.translations[0]?.slug ?? product.slug}`, dailyBudgetMicros: 5_000_000 },
    });
  }
  return NextResponse.json({ ok: true, count: products.length });
}
