import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { v3 } from "@google-cloud/translate";
import { Coating, Locale, Preparation, Prisma, PrismaClient, Salting } from "@prisma/client";
import {
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  toProductPlainText,
} from "../lib/product-content";
import { slugify } from "../lib/slugify";

const prisma = new PrismaClient();
const translateClient = new v3.TranslationServiceClient();
const applyChanges = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length);
const manifestArgument = process.argv.find((value) => value.startsWith("--manifest="))?.slice("--manifest=".length);
const sitemapArgument = process.argv.find((value) => value.startsWith("--sitemap="))?.slice("--sitemap=".length);
const reportArgument = process.argv.find((value) => value.startsWith("--report="))?.slice("--report=".length);
const requiredConfirmation = "RESTORE-CATALOG-2026-08-21";

type SourceRow = Record<string, string>;
type SourceFamily = { family: string; rows: SourceRow[] };
type RestoreManifest = { families: SourceFamily[] };
type DescriptionBatchEntry = {
  currentNlName: string;
  shortDescriptionHtml: string;
  descriptionHtml: string;
};

const verifiedImageKeys: Record<string, string[]> = {
  "Agave siroop Licht & Mild": [
    "products/agave-siroop-licht-mild/ffc92911-c4ff-42c5-a90f-42c26683ea6f.png",
  ],
  "Agavesiroop Donker & Rijk": [
    "products/agavesiroop-donker-rijk/d432a283-fe75-419c-97db-01833dad33b0.png",
  ],
  Dadelstroop: ["products/dadelstroop/dc1e5a18-c725-4657-8312-9be313c437b4.png"],
  "Iran Dadels": ["products/iran-dadel/c41d7a00-7270-4383-8d3f-38921988d3ce.png"],
  "Kleine Gele Rozijnen": [
    "products/kleine-gele-rozijnen/218b5260-1870-4f42-80c6-a993634f6fd1.png",
    "products/kleine-gele-rozijnen/34b1af40-2837-48a1-9538-ff856d936136.png",
  ],
  "Walnootstukjes Klein": [
    "products/walnootstukjes-klein/fdd8d3bb-e088-4eb5-a9e1-a066ca4c614e.png",
    "products/walnootstukjes-klein/7d34ade7-b5c4-477d-a1bc-9bcd9236771a.png",
  ],
};

const categorySlugsByFamily: Record<string, Array<{ slug: string; isPrimary: boolean }>> = {
  "Agave siroop Licht & Mild": [{ slug: "honing-natuurvoeding", isPrimary: true }],
  "Agavesiroop Donker & Rijk": [{ slug: "honing-natuurvoeding", isPrimary: true }],
  Dadelstroop: [{ slug: "honing-natuurvoeding", isPrimary: true }],
  "Iran Dadels": [
    { slug: "chocolade-zoet", isPrimary: false },
    { slug: "zoet", isPrimary: false },
    { slug: "gedroogd-fruit", isPrimary: true },
  ],
  "Kleine Gele Rozijnen": [
    { slug: "chocolade-zoet", isPrimary: false },
    { slug: "zoet", isPrimary: false },
    { slug: "gedroogd-fruit", isPrimary: true },
  ],
  "Nuts Today Medjoul Dadels": [
    { slug: "chocolade-zoet", isPrimary: false },
    { slug: "zoet", isPrimary: false },
    { slug: "gedroogd-fruit", isPrimary: true },
  ],
  "Walnootstukjes Klein": [
    { slug: "noten", isPrimary: false },
    { slug: "walnoten", isPrimary: true },
  ],
  "Chocolade Notenmix": [
    { slug: "chocolade-zoet", isPrimary: false },
    { slug: "chocolade", isPrimary: true },
  ],
};

const aliases: Array<{ slug: string; targetName: string }> = [
  { slug: "agave-siroop-licht-mild", targetName: "Agave siroop Licht & Mild" },
  { slug: "agavesiroop-donker-rijk", targetName: "Agavesiroop Donker & Rijk" },
  { slug: "iran-dadel", targetName: "Iran Dadels" },
  { slug: "haver-vlokken", targetName: "Havervlokken" },
  { slug: "meergranen-vlokken", targetName: "Meergranenvlokken" },
  { slug: "pistaches-gezouten", targetName: "Pistaches Gebrand Gezouten" },
  { slug: "sinaasappelhoning", targetName: "Sinaasappelhoning Vloeibaar" },
];

const batchNameByFamily: Record<string, string> = {
  Dadelstroop: "Dadelstroop",
  "Iran Dadels": "Iran dadel",
};

function argumentPath(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} ontbreekt.`);
  return resolve(process.cwd(), value);
}

function parsePriceCents(raw: string): number | null {
  const normalized = raw.replace(/[€\s]/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraph(value: string, short = false): string | null {
  if (!value.trim()) return null;
  const html = `<p>${escapeHtml(value.trim())}</p>`;
  return short ? sanitizeProductShortHtml(html) : sanitizeProductHtml(html);
}

function mapPreparation(value: string): Preparation {
  const lower = value.toLowerCase();
  return lower.includes("gebrand") && !lower.includes("ongebrand") ? Preparation.ROASTED : Preparation.RAW;
}

function mapSalting(value: string): Salting {
  const lower = value.toLowerCase();
  return lower.includes("gezouten") && !lower.includes("ongezouten") ? Salting.SALTED : Salting.UNSALTED;
}

function mapCoating(row: SourceRow): Coating {
  return `${row["Hoofdcategorie"]} ${row["Producttype"]} ${row["Smaak"]}`.toLowerCase().includes("chocolade")
    ? Coating.CHOCOLATE
    : Coating.NONE;
}

function isVariantActive(row: SourceRow, priceCents: number | null): boolean {
  return priceCents !== null
    && row.Publiceren.trim().toLowerCase() !== "nee"
    && row.Zichtbaarheid.trim().toLowerCase() !== "verborgen"
    && row.Voorraadstatus.trim().toLowerCase() !== "niet op voorraad";
}

async function readDescriptionBatches(): Promise<Map<string, DescriptionBatchEntry>> {
  const directory = resolve(process.cwd(), "content/product-descriptions");
  const files = (await readdir(directory)).filter((file) => /^nl-batch-\d+\.json$/.test(file)).sort();
  const entries: DescriptionBatchEntry[] = [];
  for (const file of files) {
    entries.push(...JSON.parse(await readFile(resolve(directory, file), "utf8")) as DescriptionBatchEntry[]);
  }
  return new Map(entries.map((entry) => [entry.currentNlName, entry]));
}

async function translateFields(fields: string[], targetLanguageCode: "en" | "fr"): Promise<string[]> {
  const nonEmptyFields = fields.filter((field) => field.trim().length > 0);
  if (nonEmptyFields.length === 0) return fields;
  const projectId = await translateClient.getProjectId();
  const [response] = await translateClient.translateText({
    parent: `projects/${projectId}/locations/global`,
    contents: nonEmptyFields,
    mimeType: "text/plain",
    sourceLanguageCode: "nl",
    targetLanguageCode,
  });
  const translated = response.translations ?? [];
  let cursor = 0;
  return fields.map((field) => field.trim().length > 0
    ? translated[cursor++]?.translatedText ?? field
    : field);
}

function attributesForRow(row: SourceRow): Array<{ key: string; value: string }> {
  const values: Array<[string, string]> = [
    ["ingredients", row.Ingrediënten],
    ["allergens", row.Allergenen],
    ["mayContainTraces", row["Kan sporen bevatten van"]],
    ["energyKj", row["Energie kJ per 100g"]],
    ["energyKcal", row["Energie kcal per 100g"]],
    ["fat", row["Vet per 100g"]],
    ["saturatedFat", row["Waarvan verzadigd per 100g"]],
    ["carbohydrates", row["Koolhydraten per 100g"]],
    ["sugars", row["Waarvan suikers per 100g"]],
    ["fiber", row["Vezels per 100g"]],
    ["protein", row["Eiwitten per 100g"]],
    ["salt", row["Zout per 100g"]],
    ["faq.1.question.nl", row["FAQ vraag 1"]],
    ["faq.1.answer.nl", row["FAQ antwoord 1"]],
    ["faq.2.question.nl", row["FAQ vraag 2"]],
    ["faq.2.answer.nl", row["FAQ antwoord 2"]],
  ];
  return values.filter((entry): entry is [string, string] => Boolean(entry[1])).map(([key, value]) => ({ key, value }));
}

async function main() {
  if (applyChanges && confirmation !== requiredConfirmation) {
    throw new Error(`Apply geblokkeerd. Voeg --confirm=${requiredConfirmation} toe.`);
  }

  const manifestPath = argumentPath(manifestArgument, "--manifest");
  const sitemapPath = argumentPath(sitemapArgument, "--sitemap");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RestoreManifest;
  const sitemap = await readFile(sitemapPath, "utf8");
  const priorSlugs = new Set([...sitemap.matchAll(/<loc>https:\/\/denotenman\.com\/nl\/producten\/([^<]+)<\/loc>/g)].map((match) => match[1]));
  const descriptionBatches = await readDescriptionBatches();

  const [products, translations, existingAliases, categories] = await Promise.all([
    prisma.product.findMany({
      include: {
        translations: true,
        variants: true,
      },
    }),
    prisma.productTranslation.findMany(),
    prisma.productSlugAlias.findMany(),
    prisma.category.findMany(),
  ]);

  const productByNlName = new Map(
    products.flatMap((product) => {
      const nl = product.translations.find((translation) => translation.locale === Locale.nl);
      return nl ? [[nl.name, product] as const] : [];
    }),
  );
  const variantBySku = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.sku, { product, variant }] as const)));
  const productSkuSet = new Set(products.map((product) => product.sku));
  const translationByLocaleSlug = new Map(translations.map((translation) => [`${translation.locale}:${translation.slug}`, translation]));
  const aliasByLocaleSlug = new Map(existingAliases.map((alias) => [`${alias.locale}:${alias.slug}`, alias]));
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  const familyPlans = manifest.families.map((family) => {
    const skus = family.rows.map((row) => row.SKU);
    const existingRows = skus.map((sku) => variantBySku.get(sku)).filter(Boolean);
    const existingProductIds = new Set(existingRows.map((entry) => entry!.product.id));
    const firstRow = family.rows[0];
    const nlSlug = slugify(firstRow["URL slug"] || family.family);
    const productSku = `${firstRow.SKU}-P`;
    const missingCategories = (categorySlugsByFamily[family.family] ?? []).filter((item) => !categoryBySlug.has(item.slug));
    const blockers: string[] = [];
    if (existingRows.length > 0 && (existingRows.length !== skus.length || existingProductIds.size !== 1)) blockers.push("gedeeltelijk/conflicterend SKU-herstel");
    if (existingRows.length === 0 && productSkuSet.has(productSku)) blockers.push(`product-SKU bestaat al: ${productSku}`);
    if (existingRows.length === 0 && translationByLocaleSlug.has(`${Locale.nl}:${nlSlug}`)) blockers.push(`NL slug bestaat al: ${nlSlug}`);
    if (missingCategories.length) blockers.push(`categorie ontbreekt: ${missingCategories.map((item) => item.slug).join(", ")}`);
    const variants = family.rows.map((row) => {
      const priceCents = parsePriceCents(row.Prijs);
      return { sku: row.SKU, priceCents: priceCents ?? 0, isActive: isVariantActive(row, priceCents) };
    });
    return {
      family,
      status: existingRows.length === skus.length && existingProductIds.size === 1 ? "already-created" as const : "create" as const,
      nlSlug,
      productSku,
      variants,
      blockers,
    };
  });

  const reactivations = products.filter((product) => {
    if (product.isActive || !product.variants.some((variant) => variant.priceCents > 0)) return false;
    const nl = product.translations.find((translation) => translation.locale === Locale.nl);
    return Boolean(nl && (priorSlugs.has(nl.slug) || nl.name === "Sinaasappelhoning Vloeibaar"));
  });
  const heldWithoutPrice = products.filter((product) => {
    if (product.isActive || product.variants.some((variant) => variant.priceCents > 0)) return false;
    const nl = product.translations.find((translation) => translation.locale === Locale.nl);
    return Boolean(nl && priorSlugs.has(nl.slug));
  });

  const plannedFamilyNames = new Set(manifest.families.map((family) => family.family));
  const aliasPlans = aliases.map((alias) => {
    const currentTarget = productByNlName.get(alias.targetName);
    const plannedTarget = plannedFamilyNames.has(alias.targetName);
    const translationConflict = translationByLocaleSlug.get(`${Locale.nl}:${alias.slug}`);
    const existingAlias = aliasByLocaleSlug.get(`${Locale.nl}:${alias.slug}`);
    const blockers: string[] = [];
    if (!currentTarget && !plannedTarget) blockers.push("doelproduct ontbreekt");
    if (translationConflict && translationConflict.productId !== currentTarget?.id) blockers.push("slug is een bestaande productvertaling");
    if (existingAlias && currentTarget && existingAlias.productId !== currentTarget.id) blockers.push("alias wijst naar een ander product");
    return { ...alias, status: existingAlias ? "already-created" : "create", blockers };
  });

  const blockers = [
    ...familyPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.family.family}: ${blocker}`)),
    ...aliasPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.slug}: ${blocker}`)),
  ];
  const report = {
    mode: applyChanges ? "apply-requested" : "dry-run",
    generatedAt: new Date().toISOString(),
    before: {
      products: products.length,
      activeProducts: products.filter((product) => product.isActive).length,
      variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    },
    createFamilies: familyPlans.filter((plan) => plan.status === "create").map((plan) => ({
      name: plan.family.family,
      slug: plan.nlSlug,
      productSku: plan.productSku,
      variants: plan.variants,
      images: verifiedImageKeys[plan.family.family]?.length ?? 0,
    })),
    alreadyCreatedFamilies: familyPlans.filter((plan) => plan.status === "already-created").map((plan) => plan.family.family),
    reactivateProducts: reactivations.map((product) => ({
      id: product.id,
      name: product.translations.find((translation) => translation.locale === Locale.nl)?.name,
      pricedVariants: product.variants.filter((variant) => variant.priceCents > 0).map((variant) => ({ sku: variant.sku, priceCents: variant.priceCents })),
    })),
    heldWithoutPrice: heldWithoutPrice.map((product) => product.translations.find((translation) => translation.locale === Locale.nl)?.name),
    aliases: aliasPlans.map(({ slug, targetName, status }) => ({ slug, targetName, status })),
    blockers,
  };
  if (reportArgument) await writeFile(resolve(process.cwd(), reportArgument), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!applyChanges) return;
  if (blockers.length) throw new Error(`Apply geblokkeerd door ${blockers.length} conflict(en).`);

  const preparedFamilies = await Promise.all(familyPlans.filter((plan) => plan.status === "create").map(async (plan) => {
    const firstRow = plan.family.rows[0];
    const nlFields = [
      firstRow["Productnaam webshop"] || plan.family.family,
      firstRow["Korte producttekst"] || "",
      firstRow["Lange producttekst"] || "",
      firstRow["SEO titel"] || "",
      firstRow["Meta omschrijving"] || "",
      firstRow["FAQ vraag 1"] || "",
      firstRow["FAQ antwoord 1"] || "",
      firstRow["FAQ vraag 2"] || "",
      firstRow["FAQ antwoord 2"] || "",
    ];
    const [enFields, frFields] = await Promise.all([translateFields(nlFields, "en"), translateFields(nlFields, "fr")]);
    return { ...plan, fields: { nl: nlFields, en: enFields, fr: frFields } };
  }));

  await prisma.$transaction(async (transaction) => {
    for (const product of reactivations) {
      const pricedVariants = product.variants.filter((variant) => variant.priceCents > 0);
      const basePriceCents = Math.min(...pricedVariants.map((variant) => variant.priceCents));
      const productResult = await transaction.product.updateMany({
        where: { id: product.id, isActive: false },
        data: { isActive: true, basePriceCents },
      });
      if (productResult.count !== 1) throw new Error(`Gelijktijdige productwijziging: ${product.id}`);
      await transaction.productVariant.updateMany({
        where: { productId: product.id, priceCents: { gt: 0 } },
        data: { isActive: true },
      });
    }

    const createdByFamily = new Map<string, string>();
    for (const plan of preparedFamilies) {
      const firstRow = plan.family.rows[0];
      const variants = plan.family.rows.map((row) => {
        const priceCents = parsePriceCents(row.Prijs);
        return {
          sku: row.SKU,
          priceCents: priceCents ?? 0,
          weightGrams: Number(row["Gewicht in gram"]) || 0,
          preparation: mapPreparation(row.Bewerking || ""),
          salting: mapSalting(row.Zoutstatus || ""),
          coating: mapCoating(row),
          isActive: isVariantActive(row, priceCents),
          label: row["Gewicht label"] || row.Variantnaam || "Verpakking",
        };
      });
      const activePrices = variants.filter((variant) => variant.isActive).map((variant) => variant.priceCents);
      const nlName = plan.fields.nl[0];
      const batch = descriptionBatches.get(batchNameByFamily[plan.family.family] ?? "");
      const nlShortHtml = batch?.shortDescriptionHtml
        ? sanitizeProductShortHtml(batch.shortDescriptionHtml)
        : paragraph(plan.fields.nl[1], true);
      const nlDescriptionHtml = batch?.descriptionHtml
        ? sanitizeProductHtml(batch.descriptionHtml)
        : paragraph(plan.fields.nl[2]);
      const localeFields: Record<"nl" | "en" | "fr", string[]> = plan.fields;
      const localeSlugs: Record<"nl" | "en" | "fr", string> = {
        nl: plan.nlSlug,
        en: `${plan.nlSlug}-en`,
        fr: `${plan.nlSlug}-fr`,
      };
      const created = await transaction.product.create({
        data: {
          slug: plan.nlSlug,
          sku: plan.productSku,
          basePriceCents: activePrices.length ? Math.min(...activePrices) : 0,
          isActive: activePrices.length > 0,
          translations: {
            create: (["nl", "en", "fr"] as const).map((locale) => {
              const fields = localeFields[locale];
              const shortHtml = locale === "nl" ? nlShortHtml : paragraph(fields[1], true);
              const descriptionHtml = locale === "nl" ? nlDescriptionHtml : paragraph(fields[2]);
              return {
                locale,
                name: fields[0] || nlName,
                slug: localeSlugs[locale],
                shortDescription: shortHtml ? toProductPlainText(shortHtml) : null,
                shortDescriptionHtml: shortHtml,
                description: descriptionHtml ? toProductPlainText(descriptionHtml) : null,
                descriptionHtml,
                seoTitle: fields[3] || null,
                metaDescription: fields[4] || null,
              };
            }),
          },
          variants: {
            create: variants.map((variant) => ({
              sku: variant.sku,
              priceCents: variant.priceCents,
              weightGrams: variant.weightGrams,
              preparation: variant.preparation,
              salting: variant.salting,
              coating: variant.coating,
              isActive: variant.isActive,
              translations: {
                create: (["nl", "en", "fr"] as const).map((locale) => ({ locale, label: variant.label })),
              },
            })),
          },
          productCategories: {
            create: (categorySlugsByFamily[plan.family.family] ?? []).map((item, index) => ({
              categoryId: categoryBySlug.get(item.slug)!.id,
              isPrimary: item.isPrimary,
              sortOrder: index,
            })),
          },
          attributes: {
            create: attributesForRow(firstRow),
          },
          images: {
            create: (verifiedImageKeys[plan.family.family] ?? []).map((storageKey, index) => ({
              storageKey,
              alt: firstRow["Afbeelding alt-tekst"] || nlName,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          },
        },
      });
      createdByFamily.set(plan.family.family, created.id);
    }

    for (const alias of aliasPlans.filter((plan) => plan.status === "create")) {
      const productId = productByNlName.get(alias.targetName)?.id ?? createdByFamily.get(alias.targetName);
      if (!productId) throw new Error(`Aliasdoel niet gevonden: ${alias.targetName}`);
      await transaction.productSlugAlias.create({ data: { locale: Locale.nl, slug: alias.slug, productId } });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 180_000,
  });

  console.log(JSON.stringify({
    mode: "applied",
    createdFamilies: preparedFamilies.length,
    reactivatedProducts: reactivations.length,
    createdAliases: aliasPlans.filter((plan) => plan.status === "create").length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
