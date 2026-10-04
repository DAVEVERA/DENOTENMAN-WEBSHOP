import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin-auth";
import { prisma } from "../lib/prisma";
import { PATCH as updateProduct } from "../app/api/admin/products/[id]/route";
import { PATCH as updateProductVisibility } from "../app/api/admin/products/[id]/visibility/route";

function requireLocalQa(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
}

test("an online product cannot be degraded and a dirty status save can be undone", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const slug = `publication-route-${suffix}`;
  const sku = `PUB-${suffix}`;
  const origin = "http://localhost:3105";
  const admin = await prisma.adminUser.create({
    data: {
      username: `publication-route-${suffix}`,
      passwordHash: "unused",
      name: "Release QA",
      role: "OWNER",
    },
  });
  const category = await prisma.category.create({
    data: {
      slug: `publication-category-${suffix}`,
      isActive: true,
      translations: {
        create: {
          locale: "nl",
          name: "Publicatie QA",
          slug: `publication-category-${suffix}`,
        },
      },
    },
  });
  const product = await prisma.product.create({
    data: {
      slug,
      sku,
      basePriceCents: 500,
      isActive: true,
      translations: {
        create: { locale: "nl", slug, name: "Publicatie route QA" },
      },
      variants: {
        create: {
          sku: `${sku}-250`,
          priceCents: 500,
          stock: 0,
          weightGrams: 250,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          isActive: true,
        },
      },
      productCategories: {
        create: { categoryId: category.id, isPrimary: true, sortOrder: 0 },
      },
      images: {
        create: { storageKey: `release-qa/${suffix}.webp`, isPrimary: true },
      },
    },
    include: { variants: true },
  });
  const token = await createAdminSessionToken(admin.id);
  const cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
  const request = (body: unknown) => new NextRequest(`${origin}/api/admin/products/${product.id}`, {
    method: "PATCH",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const basePayload = {
    version: product.updatedAt.toISOString(),
    sku,
    basePriceCents: 500,
    salePriceCents: null,
    unit: "WEIGHT" as const,
    isActive: true,
    translations: [{
      locale: "nl" as const,
      slug,
      name: "Publicatie route QA",
      shortDescription: null,
      description: null,
      descriptionHtml: null,
      seoTitle: null,
      metaDescription: null,
      promotionText: null,
    }],
    categories: [{ categoryId: category.id, isPrimary: true, sortOrder: 0 }],
    categoryPlacementMode: "manual" as const,
    recommendationIds: [],
    variants: [{
      id: product.variants[0].id,
      sku: product.variants[0].sku,
      label: "250 gram",
      weightGrams: 250,
      preparation: "RAW" as const,
      salting: "UNSALTED" as const,
      coating: "NONE" as const,
      isActive: true,
      priceCents: 500,
      salePriceCents: null,
      stock: 0,
    }],
  };

  try {
    const degradedResponse = await updateProduct(request({
      ...basePayload,
      variants: [{ ...basePayload.variants[0], isActive: false }],
    }), { params: Promise.resolve({ id: product.id }) });
    assert.equal(degradedResponse.status, 422);
    const degradedBody = await degradedResponse.json() as {
      error: string;
      issues: Array<{ code: string }>;
    };
    assert.equal(degradedBody.error, "PUBLICATION_BLOCKED");
    assert.ok(
      degradedBody.issues.some((issue) => issue.code === "ACTIVE_VARIANT_WITH_PRICE_REQUIRED"),
    );
    assert.equal(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).isActive,
      true,
      "a rejected degradation must not partially update the variant",
    );

    const dirtySaveResponse = await updateProduct(request({
      ...basePayload,
      isActive: false,
      translations: [{ ...basePayload.translations[0], seoTitle: "Opgeslagen tijdens statuswijziging" }],
    }), { params: Promise.resolve({ id: product.id }) });
    assert.equal(dirtySaveResponse.status, 200, await dirtySaveResponse.clone().text());
    const dirtySave = await dirtySaveResponse.json() as { version: string; undoToken: string | null };
    assert.ok(dirtySave.undoToken, "the atomic dirty save must return an undo token");

    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { translations: true },
    });
    assert.equal(saved.isActive, false);
    assert.equal(saved.translations[0]?.seoTitle, "Opgeslagen tijdens statuswijziging");

    const undoResponse = await updateProductVisibility(
      new NextRequest(`${origin}/api/admin/products/${product.id}/visibility`, {
        method: "PATCH",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify({
          isActive: true,
          version: dirtySave.version,
          undoToken: dirtySave.undoToken,
        }),
      }),
      { params: Promise.resolve({ id: product.id }) },
    );
    assert.equal(undoResponse.status, 200, await undoResponse.clone().text());
    const undone = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { translations: true },
    });
    assert.equal(undone.isActive, true);
    assert.equal(
      undone.translations[0]?.seoTitle,
      "Opgeslagen tijdens statuswijziging",
      "undo restores only visibility and preserves the dirty fields saved atomically",
    );
  } finally {
    await prisma.auditLog.deleteMany({ where: { adminUserId: admin.id } });
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    await prisma.variantTranslation.deleteMany({
      where: { variant: { productId: product.id } },
    });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.productTranslation.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.categoryTranslation.deleteMany({ where: { categoryId: category.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
});
