import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin-auth";
import { POST as createProduct } from "../app/api/admin/products/route";
import { PATCH as updateProduct } from "../app/api/admin/products/[id]/route";
import { POST as subscribeStock } from "../app/api/stock-notifications/route";
import { POST as googleAdsAction } from "../app/api/admin/google-ads/route";
import { POST as uploadImage } from "../app/api/admin/products/[id]/images/route";
import { priceCartLines } from "../lib/orders";
import { getProductBySlug } from "../lib/queries";
import { buildProductAudit } from "../lib/product-audit";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Refusing integration test outside the temporary localhost database.");
}

async function cleanup(ids: string[]) {
  if (!ids.length) return;
  await prisma.$transaction([
    prisma.stockNotification.deleteMany({ where: { productId: { in: ids } } }),
    prisma.googleAdsConfiguration.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productSlugAlias.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productRecommendation.deleteMany({ where: { OR: [{ sourceProductId: { in: ids } }, { targetProductId: { in: ids } }] } }),
    prisma.productCategory.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productImage.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productAttribute.deleteMany({ where: { productId: { in: ids } } }),
    prisma.variantTranslation.deleteMany({ where: { variant: { productId: { in: ids } } } }),
    prisma.productVariant.deleteMany({ where: { productId: { in: ids } } }),
    prisma.productTranslation.deleteMany({ where: { productId: { in: ids } } }),
    prisma.product.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

async function main() {
  process.env.ADMIN_SESSION_SECRET = "integration-test-secret-at-least-32-characters";
  delete process.env.RESEND_API_KEY;
  for (const key of ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]) delete process.env[key];
  const token = await createAdminSessionToken();
  const cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
  const request = (url: string, body: unknown) => new NextRequest(url, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

  const stale = await prisma.product.findMany({ where: { sku: { startsWith: "INTEGRATION-" } }, select: { id: true } });
  await cleanup(stale.map((item) => item.id));

  const category = await prisma.category.findFirst({ orderBy: { createdAt: "asc" } });
  const recommendations = await prisma.product.findMany({ take: 3, orderBy: { createdAt: "asc" }, select: { id: true } });
  assert.ok(category);
  assert.equal(recommendations.length, 3);

  const suffix = Date.now().toString(36);
  let productId: string | undefined;
  try {
    const payload = {
      sku: `INTEGRATION-${suffix}`,
      slug: `integration-product-${suffix}`,
      basePriceCents: 795,
      salePriceCents: 695,
      unit: "WEIGHT",
      isActive: false,
      translation: { name: "Integratie amandelen", shortDescription: "Vol en knapperig, lokaal getest voor een veilige productbeheerflow.", description: "Een uitgebreide lokale testomschrijving die uitsluitend in de tijdelijke PostgreSQL-database wordt gebruikt." },
      categoryIds: [category.id],
      recommendationIds: recommendations.map((item) => item.id),
      variants: [{ sku: `INTEGRATION-${suffix}-250`, label: "250 gram", weightGrams: 250, preparation: "ROASTED", salting: "UNSALTED", coating: "NONE", isActive: true, priceCents: 795, salePriceCents: 695, stock: 8 }],
    };
    const createdResponse = await createProduct(request("http://localhost/api/admin/products", payload));
    assert.equal(createdResponse.status, 201, await createdResponse.clone().text());
    const created = await createdResponse.json() as { productId: string };
    productId = created.productId;

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true, recommendations: true } });
    assert.equal(stored.salePriceCents, 695);
    assert.equal(stored.recommendations.length, 3);
    assert.equal(stored.variants[0]?.weightGrams, 250);

    const subscriptionResponse = await subscribeStock(new NextRequest("http://localhost/api/stock-notifications", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.42" }, body: JSON.stringify({ productId, email: "voorraadtest@example.com", locale: "nl", consent: true, website: "" }) }));
    assert.equal(subscriptionResponse.status, 201, await subscriptionResponse.clone().text());

    const newSlug = `${payload.slug}-nieuw`;
    const updateRequest = new NextRequest(`http://localhost/api/admin/products/${productId}`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ ...payload, version: stored.updatedAt.toISOString(), slug: newSlug, isActive: true, variants: [{ id: stored.variants[0].id, sku: stored.variants[0].sku, label: "300 gram", weightGrams: 300, preparation: "ROASTED", salting: "UNSALTED", coating: "NONE", isActive: true, priceCents: 895, salePriceCents: 745, stock: 12 }] }) });
    const updatedResponse = await updateProduct(updateRequest, { params: Promise.resolve({ id: productId }) });
    assert.equal(updatedResponse.status, 200, await updatedResponse.clone().text());

    const notification = await prisma.stockNotification.findFirstOrThrow({ where: { productId } });
    assert.equal(notification.status, "PENDING", "Without a Resend key, consent remains pending instead of being falsely marked sent");
    const oldUrlProduct = await getProductBySlug(payload.slug, "nl");
    assert.equal(oldUrlProduct?.slug, newSlug);

    const priced = await priceCartLines([{ variantId: stored.variants[0].id, quantity: 2 }], "nl");
    assert.equal(priced.lines[0]?.unitPriceCents, 745, "Checkout must use the server-side variant action price");

    const adsSave = await googleAdsAction(request("http://localhost/api/admin/google-ads", { action: "save", productId, headlines: ["Integratie amandelen", "Vers van De Notenman", "Bestel eenvoudig online"], descriptions: ["Knapperige amandelen, zorgvuldig verpakt en eenvoudig online besteld.", "Bekijk het assortiment van De Notenman en bestel veilig online."], finalUrl: `https://denotenman.com/nl/producten/${newSlug}`, dailyBudgetMicros: 5_000_000 }));
    assert.equal(adsSave.status, 200, await adsSave.clone().text());
    const adsPublish = await googleAdsAction(request("http://localhost/api/admin/google-ads", { action: "publish", productId }));
    assert.equal(adsPublish.status, 503, "Publishing must stay blocked without Google Ads credentials");

    const audit = await buildProductAudit(productId);
    assert.ok(audit && audit.score >= 0 && audit.score <= 100);

    const form = new FormData();
    form.set("file", new File(["not-an-image"], "fake.jpg", { type: "image/jpeg" }));
    const imageResponse = await uploadImage(new NextRequest(`http://localhost/api/admin/products/${productId}/images`, { method: "POST", headers: { cookie }, body: form }), { params: Promise.resolve({ id: productId }) });
    assert.equal(imageResponse.status, 400, "Invalid bytes must be rejected before GCS is called");

    console.log("admin product integration flow: ok");
  } finally {
    if (productId) await cleanup([productId]);
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
