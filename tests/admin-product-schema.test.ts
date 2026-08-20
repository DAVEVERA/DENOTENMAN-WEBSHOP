import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PRODUCT_CATEGORY_ASSIGNMENTS,
  getProductTranslations,
  productAdminInputSchema,
  slugifyProduct,
} from "../lib/admin-product-schema";
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
      shortDescriptionHtml: '<p><span data-rt-font="heading" data-rt-size="lg">Vol</span> van smaak.</p>',
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

test("normalizes the legacy Dutch description path into the rich and plain contract", () => {
  const result = productAdminInputSchema.safeParse(validProduct);
  assert.equal(result.success, true);
  if (!result.success) return;

  const [translation] = getProductTranslations(result.data);
  assert.equal(translation?.shortDescription, "Vol van smaak.");
  assert.equal(translation?.shortDescriptionHtml, "Vol van smaak.");
  assert.equal(translation?.description, "Een duidelijke productomschrijving.");
  assert.equal(translation?.descriptionHtml, "Een duidelijke productomschrijving.");
});

test("retains localized content, nutrition and category assignments in the parsed contract", () => {
  const result = productAdminInputSchema.safeParse(additiveProduct);
  assert.equal(result.success, true);
  if (!result.success) return;

  const parsed = result.data as unknown as {
    translations?: Array<{
      locale: string;
      shortDescription: string | null;
      shortDescriptionHtml: string | null;
      description: string | null;
      descriptionHtml: string | null;
      seoTitle: string | null;
    }>;
    nutrition?: Record<string, string | null>;
    categories?: Array<{ categoryId: string; isPrimary: boolean; sortOrder: number }>;
  };
  assert.equal(parsed.translations?.length, 3);
  assert.equal(parsed.translations?.[0]?.seoTitle, "Gebrande amandelen kopen");
  assert.equal(parsed.translations?.[0]?.shortDescription, "Vol van smaak.");
  assert.equal(
    parsed.translations?.[0]?.shortDescriptionHtml,
    '<p><span data-rt-font="heading" data-rt-size="lg">Vol</span> van smaak.</p>'
  );
  assert.equal(parsed.translations?.[0]?.description, "Een rijke omschrijving.");
  assert.equal(parsed.translations?.[0]?.descriptionHtml, "<p>Een <strong>rijke</strong> omschrijving.</p>");
  assert.equal(parsed.nutrition?.["nutrition.protein"], "21.0");
  assert.deepEqual(parsed.categories?.map((category) => category.sortOrder), [4, 9]);
});

test("derives both plain descriptions from sanitized rich text", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    translations: [
      {
        ...additiveProduct.translations[0],
        shortDescription: "Deze clientwaarde mag niet leidend zijn.",
        shortDescriptionHtml: '<div><b>Knapperig</b> &amp; <i>romig</i><script>alert(1)</script></div>',
        description: "Ook deze clientwaarde mag niet leidend zijn.",
        descriptionHtml: '<div>Volle <span data-rt-font="body" data-rt-size="md" style="color:red">noten</span>.</div>',
      },
    ],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  const translation = result.data.translations?.[0];
  assert.equal(translation?.shortDescription, "Knapperig & romig");
  assert.equal(translation?.shortDescriptionHtml, "<p><strong>Knapperig</strong> &amp; <em>romig</em></p>");
  assert.equal(translation?.description, "Volle noten.");
  assert.equal(
    translation?.descriptionHtml,
    '<p>Volle <span data-rt-font="body" data-rt-size="md">noten</span>.</p>'
  );
});

test("normalizes empty rich markup to null", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    translations: [
      {
        ...additiveProduct.translations[0],
        shortDescription: null,
        shortDescriptionHtml: "<p><br></p>",
        description: null,
        descriptionHtml: "<div> </div>",
      },
    ],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.translations?.[0]?.shortDescription, null);
  assert.equal(result.data.translations?.[0]?.shortDescriptionHtml, null);
  assert.equal(result.data.translations?.[0]?.description, null);
  assert.equal(result.data.translations?.[0]?.descriptionHtml, null);
});

test("rejects a short rich description whose sanitized plain text exceeds 220 characters", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    translations: [
      {
        ...additiveProduct.translations[0],
        shortDescription: null,
        shortDescriptionHtml: `<p>${"a".repeat(221)}</p>`,
      },
    ],
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(
    result.error.issues.some((issue) => issue.path.join(".") === "translations.0.shortDescriptionHtml"),
    true
  );
});

test("supports main category, subcategory and product group with automatic placement", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    categoryPlacementMode: "auto",
    categories: [
      { categoryId: "cm12345678901234567890123", isPrimary: false, sortOrder: 0 },
      { categoryId: "cm12345678901234567890124", isPrimary: false, sortOrder: 0 },
      { categoryId: "cm12345678901234567890125", isPrimary: true, sortOrder: 0 },
    ],
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.categoryPlacementMode, "auto");
  assert.equal(result.data.categories?.length, 3);
});

test("preserves existing products assigned to multiple complete category paths", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    categories: Array.from({ length: 6 }, (_, index) => ({
      categoryId: `cm12345678901234567890${String(index).padStart(3, "0")}`,
      isPrimary: index === 0,
      sortOrder: index,
    })),
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.categories?.length, 6);
});

test("keeps a defensive upper bound on category assignments", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    categories: Array.from({ length: MAX_PRODUCT_CATEGORY_ASSIGNMENTS + 1 }, (_, index) => ({
      categoryId: `cm12345678901234567890${String(index).padStart(3, "0")}`,
      isPrimary: index === 0,
      sortOrder: index,
    })),
  });

  assert.equal(result.success, false);
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

test("accepts Dutch decimal nutrition values and empty unknown values", () => {
  const result = productAdminInputSchema.safeParse({
    ...additiveProduct,
    nutrition: {
      ...additiveProduct.nutrition,
      "nutrition.fat": "52,4",
      "nutrition.salt": "0,01",
      "nutrition.fiber": "",
    },
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.nutrition?.["nutrition.fat"], "52,4");
  assert.equal(result.data.nutrition?.["nutrition.fiber"], null);
});

test("rejects negative, nonnumeric and implausibly long nutrition values", () => {
  for (const invalidValue of ["-1", "veel", "12 gram", "1234567890123"]) {
    const result = productAdminInputSchema.safeParse({
      ...additiveProduct,
      nutrition: { ...additiveProduct.nutrition, "nutrition.fat": invalidValue },
    });
    assert.equal(result.success, false, `Expected ${invalidValue} to be rejected`);
  }
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
