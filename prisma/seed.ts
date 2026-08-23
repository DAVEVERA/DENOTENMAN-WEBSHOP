import { PrismaClient, Preparation, Salting, Coating } from "@prisma/client";
import { Storage } from "@google-cloud/storage";
import { google } from "googleapis";
import { v3 } from "@google-cloud/translate";
import { pageKeys, pageSlugs } from "../lib/pages";
import { slugify } from "../lib/slugify";

const prisma = new PrismaClient();
const storage = new Storage();
const translateClient = new v3.TranslationServiceClient();

const locales = ["nl", "en", "fr"] as const;
const maxShortDescriptionLength = 160;
const destructiveCatalogReseedConfirmed =
  process.argv.includes("--destructive-catalog-reseed")
  && process.env.ALLOW_DESTRUCTIVE_CATALOG_RESEED === "CONFIRMED";

const pageTitles: Record<(typeof pageKeys)[number], Record<(typeof locales)[number], string>> = {
  about: { nl: "Over ons", en: "About us", fr: "À propos" },
  contact: { nl: "Contact", en: "Contact", fr: "Contact" },
  faq: { nl: "Veelgestelde vragen", en: "FAQ", fr: "FAQ" },
  shippingReturns: {
    nl: "Verzenden en retourneren",
    en: "Shipping and returns",
    fr: "Livraison et retours",
  },
  markets: { nl: "Markten", en: "Markets", fr: "Marchés" },
  terms: {
    nl: "Algemene voorwaarden",
    en: "Terms and conditions",
    fr: "Conditions générales",
  },
  additionalTerms: {
    nl: "Aanvullende voorwaarden",
    en: "Additional terms",
    fr: "Conditions complémentaires",
  },
  privacy: { nl: "Privacybeleid", en: "Privacy policy", fr: "Politique de confidentialité" },
  cookies: { nl: "Cookiebeleid", en: "Cookie policy", fr: "Politique de cookies" },
  withdrawal: { nl: "Herroepingsrecht", en: "Right of withdrawal", fr: "Droit de rétractation" },
  processingAgreement: {
    nl: "Verwerkersovereenkomst",
    en: "Data processing agreement",
    fr: "Accord de traitement des données",
  },
  subscribe: { nl: "Aanmelden nieuwsbrief", en: "Newsletter signup", fr: "Inscription newsletter" },
  optOut: { nl: "Afmelden nieuwsbrief", en: "Newsletter opt-out", fr: "Désinscription newsletter" },
};

function cleanName(str: string): string {
  let name = str
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  name = name.replace(/Pinda_s/g, "Pinda's");
  name = name.replace(/Pinda’s/g, "Pinda's");
  name = name.replace(/Pasta’s/g, "Pasta's");
  name = name.replace(/Notenpasta’s/g, "Notenpasta's");

  return name;
}

function toShortDescription(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);

  if (!normalized) return null;
  if (characters.length <= maxShortDescriptionLength) return normalized;

  const clipped = characters.slice(0, maxShortDescriptionLength - 1).join("");
  const lastSpace = clipped.lastIndexOf(" ");

  if (lastSpace <= 0) return null;

  return `${clipped.slice(0, lastSpace).trimEnd()}…`;
}

// spreadsheet SKUs carry a weight suffix (e.g. CHO-5005-250) that bucket filenames never embed.
function stripWeightSuffix(sku: string): string {
  return sku.replace(/-\d+$/, '');
}

function lookupImagesBySku(imagesBySku: Record<string, string[]>, sku: string): string[] | undefined {
  return imagesBySku[sku] || imagesBySku[stripWeightSuffix(sku)];
}

// simple word-set comparison: lowercase, strip a trailing en/s per word, ignore order.
function normalizeWordSet(str: string): string {
  return str
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.replace(/(en|s)$/, ''))
    .sort()
    .join(' ');
}

// Translations map for categories
const categoryTranslations: Record<string, Record<(typeof locales)[number], string>> = {
  "bakproducten": { nl: "Bakproducten", en: "Baking Products", fr: "Produits de Pâtisserie" },
  "chocolade-zoet": { nl: "Chocolade & Zoet", en: "Chocolate & Sweets", fr: "Chocolat & Confiseries" },
  "gedroogd-fruit": { nl: "Gedroogd fruit", en: "Dried fruit", fr: "Fruits secs" },
  "honing-natuurvoeding": { nl: "Honing & Natuurvoeding", en: "Honey & Natural Foods", fr: "Miel & Alimentation Naturelle" },
  "muesli-granen": { nl: "Muesli & Granen", en: "Muesli & Grains", fr: "Muesli & Céréales" },
  "noten": { nl: "Noten", en: "Nuts", fr: "Noix" },
  "notenmixen": { nl: "Notenmixen", en: "Nut Mixes", fr: "Mélanges de Noix" },
  "notenpasta-s": { nl: "Notenpasta's", en: "Nut Butters", fr: "Beurres de Noix" },
  "pinda-s": { nl: "Pinda's", en: "Peanuts", fr: "Cacahuètes" },
  "pitten-zaden": { nl: "Pitten & zaden", en: "Kernels & seeds", fr: "Pignons & graines" },
  "snacks-zoutjes": { nl: "Snacks & Zoutjes", en: "Snacks", fr: "Snacks" },
  "superfood": { nl: "Superfood", en: "Superfood", fr: "Superaliments" },
};

const chocolateCategorySlugs = ["chocolade-zoet"];

const sheetsClient = google.sheets({
  version: "v4",
  auth: new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  }),
});

type SheetRow = Record<string, string>;

async function fetchTab(spreadsheetId: string, tabName: string): Promise<SheetRow[]> {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: tabName,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const record: SheetRow = {};
    header.forEach((key, i) => {
      record[key] = row[i] ?? "";
    });
    return record;
  });
}

function parsePriceCents(raw: string): number | null {
  const cleaned = raw.replace(/[€\s]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function mapPreparation(bewerking: string): Preparation {
  return bewerking.toLowerCase().includes("gebrand") && !bewerking.toLowerCase().includes("ongebrand")
    ? "ROASTED"
    : "RAW";
}

function mapSalting(zoutstatus: string): Salting {
  return zoutstatus.toLowerCase().includes("gezouten") && !zoutstatus.toLowerCase().includes("ongezouten")
    ? "SALTED"
    : "UNSALTED";
}

function mapCoating(categorySlug: string, producttype: string, smaak: string): Coating {
  const text = `${producttype} ${smaak}`.toLowerCase();
  if (chocolateCategorySlugs.includes(categorySlug) || text.includes("chocolade")) {
    return "CHOCOLATE";
  }
  return "NONE";
}

async function translateBatch(texts: string[], target: "en" | "fr"): Promise<string[]> {
  const nonEmpty = texts.filter((t) => t.length > 0);
  if (nonEmpty.length === 0) return texts.map(() => "");

  const projectId = await translateClient.getProjectId();
  const [response] = await translateClient.translateText({
    parent: `projects/${projectId}/locations/global`,
    contents: nonEmpty,
    mimeType: "text/plain",
    sourceLanguageCode: "nl",
    targetLanguageCode: target,
  });

  const translated = (response.translations || []).map((t) => t.translatedText || "");
  let cursor = 0;
  return texts.map((t) => (t.length === 0 ? "" : translated[cursor++] ?? t));
}

async function translateBatchWithRetry(texts: string[], target: "en" | "fr"): Promise<string[]> {
  try {
    return await translateBatch(texts, target);
  } catch {
    return await translateBatch(texts, target);
  }
}

function uniqueSlug(candidate: string, taken: Set<string>): string {
  let slug = candidate;
  let counter = 1;
  while (taken.has(slug)) {
    slug = `${candidate}-${counter}`;
    counter++;
  }
  taken.add(slug);
  return slug;
}

function uniqueSku(candidate: string, taken: Set<string>): string {
  let sku = candidate;
  let counter = 1;
  while (taken.has(sku)) {
    sku = `${candidate}-${counter}`;
    counter++;
  }
  taken.add(sku);
  return sku;
}

type FamilyGroup = {
  familyName: string;
  categorySlug: string;
  rows: SheetRow[];
};

const nutritionFields: Array<{ key: string; header: string }> = [
  { key: "nutrition.energyKj", header: "Energie kJ per 100g" },
  { key: "nutrition.energyKcal", header: "Energie kcal per 100g" },
  { key: "nutrition.fat", header: "Vet per 100g" },
  { key: "nutrition.saturatedFat", header: "Waarvan verzadigd per 100g" },
  { key: "nutrition.carbohydrates", header: "Koolhydraten per 100g" },
  { key: "nutrition.sugars", header: "Waarvan suikers per 100g" },
  { key: "nutrition.fiber", header: "Vezels per 100g" },
  { key: "nutrition.protein", header: "Eiwitten per 100g" },
  { key: "nutrition.salt", header: "Zout per 100g" },
];

async function seedPages() {
  console.log("Seeding pages...");
  for (const key of pageKeys) {
    const createdPage = await prisma.page.upsert({
      where: { key },
      create: { key },
      update: {},
    });

    for (const locale of locales) {
      await prisma.pageTranslation.upsert({
        where: {
          pageId_locale: {
            pageId: createdPage.id,
            locale,
          },
        },
        create: {
          pageId: createdPage.id,
          locale,
          title: pageTitles[key][locale],
          slug: pageSlugs[key][locale],
          body: "",
        },
        update: {},
      });
    }
  }
}

async function main() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("GCS_BUCKET environment variable is not configured");
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID environment variable is not configured");
  }

  console.log(`Connecting to GCS bucket: "${bucketName}"...`);
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles();
  console.log(`Successfully fetched ${files.length} files from GCS.`);

  const imagesByFolderKey: Record<string, string[]> = {};
  const imagesBySku: Record<string, string[]> = {};
  const gatePathsBySegment: Record<string, Set<string>> = {};

  // "gebruikt" marker can sit at any depth below category/product; "niet gebruikt" means explicitly not used.
  const isUsedGate = (segment: string) => segment.toLowerCase().startsWith('gebruikt');
  const isUnusedGate = (segment: string) => {
    const s = segment.toLowerCase();
    return s.startsWith('niet gebruikt') || s.startsWith('niet-gebruikt') || s.startsWith('niet_gebruikt');
  };
  const isGate = (segment: string) => isUsedGate(segment) || isUnusedGate(segment);

  for (const f of files) {
    const key = f.name;
    const parts = key.split('/');
    if (parts.length < 3) continue;

    const dirParts = parts.slice(0, -1);
    const gateIdx = dirParts.findIndex((p, i) => i >= 2 && isGate(p));

    const isUsed = gateIdx === -1 || isUsedGate(dirParts[gateIdx]);
    if (!isUsed) continue;

    const filenameWithExt = parts[parts.length - 1];
    const ext = filenameWithExt.substring(filenameWithExt.lastIndexOf('.')).toLowerCase();
    if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const filename = filenameWithExt.substring(0, filenameWithExt.lastIndexOf('.'));

    // product-name folder: the one right before the gate, or the file's own parent folder when there's no gate
    const productSegment = gateIdx >= 2 ? dirParts[gateIdx - 1] : dirParts[dirParts.length - 1];
    const categorySegment = parts[0].toLowerCase();
    const folderKey = `${categorySegment}/${productSegment.toLowerCase()}`;

    if (slugify(productSegment) === slugify(parts[0])) {
      console.warn(`Suspicious product-name folder segment (matches category name) at: ${key}`);
    }
    const gateSegmentKey = `${categorySegment}::${productSegment.toLowerCase()}`;
    if (!gatePathsBySegment[gateSegmentKey]) gatePathsBySegment[gateSegmentKey] = new Set();
    gatePathsBySegment[gateSegmentKey].add(dirParts.join('/'));

    if (!imagesByFolderKey[folderKey]) imagesByFolderKey[folderKey] = [];
    imagesByFolderKey[folderKey].push(key);

    const skuMatch = filename.match(/^([A-Z]{2,4}-\d{3,5})/i);
    if (skuMatch) {
      const sku = skuMatch[0].toUpperCase();
      if (!imagesBySku[sku]) imagesBySku[sku] = [];
      imagesBySku[sku].push(key);
    }
  }

  const genericSegmentPathThreshold = 3;
  for (const [gateSegmentKey, paths] of Object.entries(gatePathsBySegment)) {
    if (paths.size >= genericSegmentPathThreshold) {
      const [category, segment] = gateSegmentKey.split('::');
      console.warn(
        `Suspicious product-name folder segment "${segment}" recurs across ${paths.size} distinct paths under category "${category}" — likely a structural folder, not a product name.`
      );
    }
  }

  console.log("Fetching spreadsheet tabs...");
  const [exportRows, archiefRows, controleRows] = await Promise.all([
    fetchTab(spreadsheetId, "Developer_export"),
    fetchTab(spreadsheetId, "Archief_niet_actief"),
    fetchTab(spreadsheetId, "Nog_te_controleren"),
  ]);
  console.log(`Fetched ${exportRows.length} rows from Developer_export.`);

  if (!destructiveCatalogReseedConfirmed) {
    throw new Error(
      "Destructieve catalogus-seed geblokkeerd. Maak en verifieer eerst een databaseback-up en gebruik daarna zowel --destructive-catalog-reseed als ALLOW_DESTRUCTIVE_CATALOG_RESEED=CONFIRMED.",
    );
  }

  const archivedFamilies = new Set(
    archiefRows.map((r) => (r["Productgroep"] || "").trim().toLowerCase()).filter(Boolean)
  );
  const variantFlagKey = (family: string, variant: string) =>
    `${family.trim().toLowerCase()}::${variant.trim().toLowerCase()}`;
  const unverifiedVariants = new Set(
    controleRows
      .map((r) => variantFlagKey(r["Productfamilie"] || "", r["Variantnaam"] || ""))
      .filter((k) => k !== "::")
  );

  console.log("Cleaning database catalog...");
  await prisma.productImage.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.variantTranslation.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.productTranslation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.categoryTranslation.deleteMany();
  await prisma.category.deleteMany();

  const uniqueCategorySlugs = Array.from(
    new Set(exportRows.map((r) => slugify(r["Hoofdcategorie"] || "")).filter(Boolean))
  );

  console.log("Seeding categories...");
  const categoryMap: Record<string, string> = {};
  let sortOrder = 1;
  for (const slug of uniqueCategorySlugs) {
    const rawName = exportRows.find((r) => slugify(r["Hoofdcategorie"] || "") === slug)?.["Hoofdcategorie"] || slug;
    const trans = categoryTranslations[slug] || {
      nl: cleanName(rawName),
      en: cleanName(rawName),
      fr: cleanName(rawName),
    };

    const createdCat = await prisma.category.create({
      data: {
        slug,
        type: "STANDARD",
        sortOrder: sortOrder++,
        translations: {
          create: locales.map((locale) => ({
            locale,
            name: trans[locale],
            slug: locale === "nl" ? slug : slugify(trans[locale]),
          })),
        },
      },
    });

    categoryMap[slug] = createdCat.id;
  }

  console.log("Seeding promotional categories...");
  await prisma.category.create({
    data: {
      slug: "acties",
      type: "PROMOTIONAL",
      sortOrder: 0,
      translations: {
        create: locales.map((locale) => ({
          locale,
          name: locale === "nl" ? "Acties" : locale === "en" ? "Deals" : "Promotions",
          slug: "acties",
        })),
      },
    },
  });

  const families = new Map<string, FamilyGroup>();
  for (const row of exportRows) {
    const familyName = row["Productfamilie"];
    if (!familyName) continue;
    if (!families.has(familyName)) {
      families.set(familyName, {
        familyName,
        categorySlug: slugify(row["Hoofdcategorie"] || ""),
        rows: [],
      });
    }
    families.get(familyName)!.rows.push(row);
  }

  console.log(`Seeding ${families.size} products...`);
  const usedProductSkus = new Set<string>();
  const usedVariantSkus = new Set<string>();
  const usedSlugs: Record<(typeof locales)[number], Set<string>> = {
    nl: new Set(),
    en: new Set(),
    fr: new Set(),
  };

  let succeededCount = 0;
  let skippedCount = 0;
  const skippedFamilies: string[] = [];

  for (const family of families.values()) {
    const categoryId = categoryMap[family.categorySlug];
    if (!categoryId) continue;

    try {
      const firstRow = family.rows[0];
      const productName = firstRow["Productnaam webshop"] || family.familyName;
      const longDescription = firstRow["Lange producttekst"] || "";
      const seoTitle = firstRow["SEO titel"] || "";
      const metaDescription = firstRow["Meta omschrijving"] || "";
      const faq1Q = firstRow["FAQ vraag 1"] || "";
      const faq1A = firstRow["FAQ antwoord 1"] || "";
      const faq2Q = firstRow["FAQ vraag 2"] || "";
      const faq2A = firstRow["FAQ antwoord 2"] || "";

      const dutchFields = [productName, longDescription, seoTitle, metaDescription, faq1Q, faq1A, faq2Q, faq2A];
      const [enFields, frFields] = await Promise.all([
        translateBatchWithRetry(dutchFields, "en"),
        translateBatchWithRetry(dutchFields, "fr"),
      ]);

      const byLocale: Record<(typeof locales)[number], typeof dutchFields> = {
        nl: dutchFields,
        en: enFields,
        fr: frFields,
      };

      const nlSlugBase = slugify(firstRow["URL slug"] || productName);
      const productSlugs: Record<(typeof locales)[number], string> = {
        nl: uniqueSlug(nlSlugBase, usedSlugs.nl),
        en: uniqueSlug(slugify(enFields[0] || productName), usedSlugs.en),
        fr: uniqueSlug(slugify(frFields[0] || productName), usedSlugs.fr),
      };

      const isFamilyArchived = archivedFamilies.has(family.familyName.trim().toLowerCase());
      const allRowsUnverified = family.rows.every((row) =>
        unverifiedVariants.has(variantFlagKey(family.familyName, row["Variantnaam"] || ""))
      );

      const catAbbr = family.categorySlug.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      const prodAbbr = family.familyName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
      const familyBaseSku = firstRow["SKU"] || `${catAbbr}-${prodAbbr}`;
      const productSku = uniqueSku(`${familyBaseSku}-P`, usedProductSkus);

      const variantsData = family.rows.map((row) => {
        const sku = uniqueSku(row["SKU"] || `${catAbbr}-${prodAbbr}`, usedVariantSkus);

        const priceCents = parsePriceCents(row["Prijs"] || "");
        const weightGrams = Number(row["Gewicht in gram"]) || 0;

        const isRowUnverified =
          allRowsUnverified || unverifiedVariants.has(variantFlagKey(family.familyName, row["Variantnaam"] || ""));

        const rowInactive =
          isFamilyArchived ||
          isRowUnverified ||
          row["Publiceren"].trim().toLowerCase() === "nee" ||
          row["Zichtbaarheid"].trim().toLowerCase() === "verborgen" ||
          row["Voorraadstatus"].trim().toLowerCase() === "niet op voorraad" ||
          priceCents === null;

        const preparation = mapPreparation(row["Bewerking"] || "");
        const salting = mapSalting(row["Zoutstatus"] || "");
        const coating = mapCoating(family.categorySlug, row["Producttype"] || "", row["Smaak"] || "");

        return {
          sku,
          priceCents: priceCents ?? 0,
          hasPrice: priceCents !== null,
          weightGrams,
          isActive: !rowInactive,
          preparation,
          salting,
          coating,
          label: row["Gewicht label"] || `${weightGrams} g`,
        };
      });

      const activeWithPrice = variantsData.find((v) => v.hasPrice && v.isActive);
      const basePriceCents = activeWithPrice?.priceCents ?? 0;
      const productIsActive = Boolean(activeWithPrice);

      const attributes: Array<{ key: string; value: string }> = [];
      if (firstRow["Ingrediënten"]) attributes.push({ key: "ingredients", value: firstRow["Ingrediënten"] });
      if (firstRow["Allergenen"]) attributes.push({ key: "allergens", value: firstRow["Allergenen"] });
      if (firstRow["Kan sporen bevatten van"]) {
        attributes.push({ key: "mayContainTraces", value: firstRow["Kan sporen bevatten van"] });
      }
      for (const field of nutritionFields) {
        const value = firstRow[field.header];
        if (value) attributes.push({ key: field.key, value });
      }
      if (faq1Q) {
        attributes.push({ key: "faq.1.question.nl", value: faq1Q });
        attributes.push({ key: "faq.1.question.en", value: enFields[4] });
        attributes.push({ key: "faq.1.question.fr", value: frFields[4] });
      }
      if (faq1A) {
        attributes.push({ key: "faq.1.answer.nl", value: faq1A });
        attributes.push({ key: "faq.1.answer.en", value: enFields[5] });
        attributes.push({ key: "faq.1.answer.fr", value: frFields[5] });
      }
      if (faq2Q) {
        attributes.push({ key: "faq.2.question.nl", value: faq2Q });
        attributes.push({ key: "faq.2.question.en", value: enFields[6] });
        attributes.push({ key: "faq.2.question.fr", value: frFields[6] });
      }
      if (faq2A) {
        attributes.push({ key: "faq.2.answer.nl", value: faq2A });
        attributes.push({ key: "faq.2.answer.en", value: enFields[7] });
        attributes.push({ key: "faq.2.answer.fr", value: frFields[7] });
      }

      let images: string[] = [];
      for (const v of variantsData) {
        const bySku = lookupImagesBySku(imagesBySku, v.sku);
        if (bySku) images = images.concat(bySku);
      }
      if (images.length === 0) {
        const sameCategoryFolderKey = Object.keys(imagesByFolderKey).find(
          (k) => k.split('/')[0] === family.categorySlug && slugify(k.split('/')[1] || '') === slugify(family.familyName)
        );
        const anyFolderKey = Object.keys(imagesByFolderKey).find(
          (k) => slugify(k.split('/')[1] || '') === slugify(family.familyName)
        );
        let matchingFolderKey = sameCategoryFolderKey || anyFolderKey;
        if (!matchingFolderKey) {
          const familyWordSet = normalizeWordSet(family.familyName);
          matchingFolderKey = Object.keys(imagesByFolderKey).find(
            (k) => k.split('/')[0] === family.categorySlug && normalizeWordSet(k.split('/')[1] || '') === familyWordSet
          );
          if (matchingFolderKey) {
            console.log(`Fuzzy-matched images for "${family.familyName}" via folder "${matchingFolderKey}"`);
          }
        }
        if (matchingFolderKey) images = imagesByFolderKey[matchingFolderKey];
      }
      images = Array.from(new Set(images));

      await prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            slug: productSlugs.nl,
            sku: productSku,
            basePriceCents,
            isActive: productIsActive,
            translations: {
              create: locales.map((locale) => ({
                locale,
                name: byLocale[locale][0] || productName,
                slug: productSlugs[locale],
                description: byLocale[locale][1] || longDescription,
                shortDescription: toShortDescription(byLocale[locale][3] || metaDescription),
              })),
            },
            variants: {
              create: variantsData.map((v) => ({
                sku: v.sku,
                priceCents: v.priceCents,
                weightGrams: v.weightGrams,
                preparation: v.preparation,
                salting: v.salting,
                coating: v.coating,
                isActive: v.isActive,
                translations: {
                  create: locales.map((locale) => ({
                    locale,
                    label: v.label,
                  })),
                },
              })),
            },
          },
        });

        await tx.productCategory.create({
          data: {
            productId: createdProduct.id,
            categoryId,
          },
        });

        if (attributes.length > 0) {
          await tx.productAttribute.createMany({
            data: attributes.map((a) => ({ productId: createdProduct.id, ...a })),
          });
        }

        let sortIdx = 0;
        for (const imgKey of images) {
          await tx.productImage.create({
            data: {
              productId: createdProduct.id,
              storageKey: imgKey,
              alt: productName,
              sortOrder: sortIdx++,
              isPrimary: sortIdx === 1,
            },
          });
        }
      });

      succeededCount++;
    } catch (error) {
      skippedCount++;
      skippedFamilies.push(family.familyName);
      console.error(`Skipping product family "${family.familyName}" after import failure:`, error);
    }
  }

  console.log(`Seeded ${succeededCount} products successfully, skipped ${skippedCount} due to errors.`);
  if (skippedFamilies.length > 0) {
    console.log(`Skipped families: ${skippedFamilies.join(", ")}`);
  }

  await seedPages();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Database seed completed successfully.");
  })
  .catch(async (error) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
