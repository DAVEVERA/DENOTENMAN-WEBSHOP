import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import type { ZodIssue } from "zod";
import * as updateRoute from "../app/api/admin/products/[id]/route";
import { productAdminInputSchema } from "../lib/admin-product-schema";

test("PATCH returns an actionable 401 contract before reading product data", async () => {
  const response = await updateRoute.PATCH(
    new NextRequest("http://localhost/api/admin/products/product-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: "product-1" }) }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "UNAUTHORIZED",
    message: "Je beheersessie is verlopen. Log opnieuw in en probeer daarna opnieuw.",
  });
});

test("validation response preserves the first exact Zod field path", () => {
  const parsed = productAdminInputSchema.safeParse({
    version: "2026-08-18T12:00:00.000Z",
    sku: "NAT-10003-350-P900",
    basePriceCents: 700,
    salePriceCents: null,
    unit: "WEIGHT",
    isActive: true,
    translations: [{
      locale: "nl",
      slug: "acaciahoning",
      name: "Acaciahoning",
      shortDescription: null,
      description: null,
      descriptionHtml: null,
      seoTitle: null,
      metaDescription: null,
      promotionText: null,
    }],
    categories: [],
    recommendationIds: [],
    variants: [{
      sku: "NAT-10003-350",
      label: "350 gr",
      weightGrams: 350,
      preparation: "RAW",
      salting: "UNSALTED",
      coating: "NONE",
      isActive: true,
      priceCents: 700,
      salePriceCents: 700,
      stock: 0,
    }],
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const module = updateRoute as unknown as {
    validationErrorContract?: (issues: ZodIssue[]) => {
      error: string;
      message: string;
      field: string;
      issues: Array<{ code: string; path: Array<string | number>; message: string }>;
    };
  };
  assert.equal(typeof module.validationErrorContract, "function");
  if (!module.validationErrorContract) return;

  const contract = module.validationErrorContract(parsed.error.issues);
  assert.equal(contract.error, "VALIDATION_ERROR");
  assert.equal(contract.field, "variants.0.salePriceCents");
  assert.equal(contract.issues[0]?.message, "Actieprijs moet lager zijn dan de normale prijs.");
});

test("variant persistence deletes only omitted unreferenced variants", () => {
  const module = updateRoute as unknown as {
    planVariantPersistence?: (
      current: Array<{ id: string; sku: string; orderItemCount: number }>,
      incoming: Array<{ id?: string; sku: string }>,
    ) => { deleteIds: string[] };
  };
  assert.equal(typeof module.planVariantPersistence, "function");
  if (!module.planVariantPersistence) return;

  assert.deepEqual(
    module.planVariantPersistence(
      [
        { id: "old-1", sku: "NAT-10003-350", orderItemCount: 0 },
        { id: "old-2", sku: "NAT-10003-900", orderItemCount: 0 },
      ],
      [{ id: "old-2", sku: "NAT-10003-900" }, { sku: "NAT-10003-NEW" }],
    ),
    { deleteIds: ["old-1"] }
  );
});

test("variant persistence refuses deletion when an order references the variant", () => {
  const module = updateRoute as unknown as {
    planVariantPersistence?: (
      current: Array<{ id: string; sku: string; orderItemCount: number }>,
      incoming: Array<{ id?: string; sku: string }>,
    ) => { deleteIds: string[] };
  };
  assert.equal(typeof module.planVariantPersistence, "function");
  if (!module.planVariantPersistence) return;

  assert.throws(
    () => module.planVariantPersistence?.(
      [{ id: "ordered", sku: "NAT-ORDERED", orderItemCount: 1 }],
      [],
    ),
    (error: unknown) => error instanceof Error
      && error.message === "VARIANT_HAS_ORDER_HISTORY"
      && (error as Error & { field?: string; variantSku?: string }).field === "variants"
      && (error as Error & { variantSku?: string }).variantSku === "NAT-ORDERED"
  );
});
