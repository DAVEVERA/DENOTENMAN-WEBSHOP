import test from "node:test";
import assert from "node:assert/strict";
import { productAdminInputSchema, slugifyProduct } from "../lib/admin-product-schema";
import { hasValidImageSignature } from "../lib/storage";

const validProduct = {
  version: new Date().toISOString(),
  sku: "TEST-PRODUCT",
  slug: "amandelen-gebrand",
  basePriceCents: 699,
  salePriceCents: 599,
  unit: "WEIGHT" as const,
  isActive: false,
  translation: { name: "Amandelen gebrand", shortDescription: "Vol van smaak.", description: "Een duidelijke productomschrijving." },
  categoryIds: ["cm12345678901234567890123"],
  recommendationIds: [],
  variants: [{ sku: "TEST-250", label: "250 gram", weightGrams: 250, preparation: "ROASTED" as const, salting: "UNSALTED" as const, coating: "NONE" as const, isActive: true, priceCents: 699, salePriceCents: 599, stock: 10 }],
};

test("accepts a complete, safe product payload", () => {
  assert.equal(productAdminInputSchema.safeParse(validProduct).success, true);
});

test("rejects action prices that do not undercut the regular price", () => {
  const result = productAdminInputSchema.safeParse({ ...validProduct, salePriceCents: 699 });
  assert.equal(result.success, false);
});

test("rejects duplicate variant SKUs and duplicate meepakkers", () => {
  const variant = validProduct.variants[0];
  const result = productAdminInputSchema.safeParse({
    ...validProduct,
    recommendationIds: ["cm12345678901234567890124", "cm12345678901234567890124"],
    variants: [variant, { ...variant }],
  });
  assert.equal(result.success, false);
});

test("creates a stable ASCII slug", () => {
  assert.equal(slugifyProduct("Crème Brûlée Noten!"), "creme-brulee-noten");
});

test("validates image bytes instead of trusting a MIME header", () => {
  assert.equal(hasValidImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
  assert.equal(hasValidImageSignature(Buffer.from("not-an-image"), "image/jpeg"), false);
});
