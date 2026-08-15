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

const additiveProduct = {
  ...validProduct,
  translations: [
    {
      locale: "nl" as const,
      slug: "amandelen-gebrand",
      name: "Amandelen gebrand",
      shortDescription: "Vol van smaak.",
      description: "Een veilige platte omschrijving.",
      descriptionHtml: '<p>Een <strong>rijke</strong> omschrijving.</p><script>alert("xss")</script>',
      seoTitle: "Gebrande amandelen kopen",
      metaDescription: "Bestel vers gebrande amandelen bij De Notenman.",
      promotionText: "Deze week extra voordelig",
    },
    {
      locale: "en" as const,
      slug: "roasted-almonds",
      name: "Roasted almonds",
      shortDescription: "Full of flavour.",
      description: "A safe plain description.",
      descriptionHtml: "<p>A rich description.</p>",
      seoTitle: "Buy roasted almonds",
      metaDescription: "Order freshly roasted almonds.",
      promotionText: "Special offer this week",
    },
    {
      locale: "fr" as const,
      slug: "amandes-grillees",
      name: "Amandes grillées",
      shortDescription: "Pleines de saveur.",
      description: "Une description simple et sûre.",
      descriptionHtml: "<p>Une description riche.</p>",
      seoTitle: "Acheter des amandes grillées",
      metaDescription: "Commandez des amandes fraîchement grillées.",
      promotionText: "Offre spéciale cette semaine",
    },
  ],
  nutrition: {
    "nutrition.energyKj": "2470",
    "nutrition.energyKcal": "590",
    "nutrition.fat": "52.0",
    "nutrition.saturatedFat": "4.0",
    "nutrition.carbohydrates": "10.0",
    "nutrition.sugars": "4.5",
    "nutrition.fiber": "11.0",
    "nutrition.protein": "21.0",
    "nutrition.salt": "0.01",
  },
  categories: [
    { categoryId: "cm12345678901234567890123", isPrimary: true, sortOrder: 4 },
    { categoryId: "cm12345678901234567890124", isPrimary: false, sortOrder: 9 },
  ],
};

test("accepts a complete, safe product payload", () => {
  assert.equal(productAdminInputSchema.safeParse(validProduct).success, true);
});

test("retains localized content, nutrition and category assignments in the parsed contract", () => {
  const result = productAdminInputSchema.safeParse(additiveProduct);
  assert.equal(result.success, true);
  if (!result.success) return;

  const parsed = result.data as unknown as {
    translations?: Array<{ locale: string; descriptionHtml: string | null; seoTitle: string | null }>;
    nutrition?: Record<string, string | null>;
    categories?: Array<{ categoryId: string; isPrimary: boolean; sortOrder: number }>;
  };
  assert.equal(parsed.translations?.length, 3);
  assert.equal(parsed.translations?.[0]?.seoTitle, "Gebrande amandelen kopen");
  assert.equal(parsed.translations?.[0]?.descriptionHtml, "<p>Een <strong>rijke</strong> omschrijving.</p>");
  assert.equal(parsed.nutrition?.["nutrition.protein"], "21.0");
  assert.deepEqual(parsed.categories?.map((category) => category.sortOrder), [4, 9]);
});

test("rejects duplicate locales instead of silently overwriting localized content", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    translations: [additiveProduct.translations[0], additiveProduct.translations[0]],
  });
  assert.equal(result.success, false);
});

test("rejects nutrition keys outside the fixed nine-key contract", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    nutrition: { ...additiveProduct.nutrition, cholesterol: "0" },
  });
  assert.equal(result.success, false);
});

test("rejects more than one primary category assignment", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    categories: additiveProduct.categories.map((category) => ({ ...category, isPrimary: true })),
  });
  assert.equal(result.success, false);
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
