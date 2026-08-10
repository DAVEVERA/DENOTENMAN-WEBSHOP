import { PrismaClient, Preparation, Salting, Coating, Locale } from "@prisma/client";
import { Storage } from "@google-cloud/storage";
import { pageKeys, pageSlugs } from "../lib/pages";

const prisma = new PrismaClient();
const storage = new Storage();

const locales = ["nl", "en", "fr"] as const;

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
  privacy: { nl: "Privacybeleid", en: "Privacy policy", fr: "Politique de confidentialité" },
  cookies: { nl: "Cookiebeleid", en: "Cookie policy", fr: "Politique de cookies" },
  withdrawal: { nl: "Herroepingsrecht", en: "Right of withdrawal", fr: "Droit de rétractation" },
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

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Translations map for categories
const categoryTranslations: Record<string, Record<(typeof locales)[number], string>> = {
  "bakproducten": { nl: "Bakproducten", en: "Baking Products", fr: "Produits de Pâtisserie" },
  "chocolade": { nl: "Chocolade", en: "Chocolate", fr: "Chocolat" },
  "gedroogd-fruit": { nl: "Gedroogd Fruit", en: "Dried Fruit", fr: "Fruits Secs" },
  "noten": { nl: "Noten", en: "Nuts", fr: "Noix" },
  "notenmixen": { nl: "Notenmixen", en: "Nut Mixes", fr: "Mélanges de Noix" },
  "notenpastas": { nl: "Notenpasta's", en: "Nut Butters", fr: "Beurres de Noix" },
  "pindas": { nl: "Pinda's", en: "Peanuts", fr: "Cacahuètes" },
  "pitten-zaden": { nl: "Pitten & Zaden", en: "Seeds & Grains", fr: "Graines" },
  "snacks": { nl: "Snacks", en: "Snacks", fr: "Snacks" },
};

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

  console.log(`Connecting to GCS bucket: "${bucketName}"...`);
  const bucket = storage.bucket(bucketName);
  const [files] = await bucket.getFiles();

  console.log(`Successfully fetched ${files.length} files from GCS.`);

  // Group images by "Category/ProductFolder"
  const groupedProducts: Record<string, {
    categoryName: string;
    productFolderName: string;
    sku: string;
    images: string[];
  }> = {};

  for (const f of files) {
    const key = f.name;
    const parts = key.split('/');
    if (parts.length < 4) continue;

    // e.g., parts = ["Noten", "Amandel", "Gebruikt", "file.webp"]
    const categoryName = cleanName(parts[0]);
    const productFolderName = cleanName(parts[1]);
    const folderKey = `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;

    const isUsed = parts[2].toLowerCase().startsWith('gebruikt');
    if (!isUsed) continue;

    const filenameWithExt = parts[parts.length - 1];
    const ext = filenameWithExt.substring(filenameWithExt.lastIndexOf('.')).toLowerCase();
    if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const filename = filenameWithExt.substring(0, filenameWithExt.lastIndexOf('.'));

    if (!groupedProducts[folderKey]) {
      groupedProducts[folderKey] = {
        categoryName,
        productFolderName,
        sku: '',
        images: []
      };
    }

    // Try to extract SKU if present (e.g. BAK-9002 or SNK-6019)
    const skuMatch = filename.match(/^([A-Z]{3,4}-\d{3,5})/i);
    if (skuMatch && !groupedProducts[folderKey].sku) {
      groupedProducts[folderKey].sku = skuMatch[0].toUpperCase();
    }

    groupedProducts[folderKey].images.push(key);
  }

  const parsedProducts = Object.values(groupedProducts);
  console.log(`Found ${parsedProducts.length} live products with images in GCS.`);

  if (parsedProducts.length === 0) {
    console.log("No live product images found in GCS. Check folder structures (should be 'Category/Product/Gebruikt/*.webp').");
    return;
  }

  // Clear existing catalog data to prevent duplication or obsolete mock items
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

  // Create standard categories first
  const categoryMap: Record<string, string> = {}; // maps clean slug to db category ID
  const uniqueCategoryNames = Array.from(new Set(parsedProducts.map(p => p.categoryName)));

  console.log("Seeding categories...");
  let sortOrder = 1;
  for (const rawCatName of uniqueCategoryNames) {
    const slug = slugify(rawCatName);
    const trans = categoryTranslations[slug] || {
      nl: rawCatName,
      en: rawCatName,
      fr: rawCatName
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
            slug: slugify(trans[locale]),
          })),
        },
      }
    });

    categoryMap[slug] = createdCat.id;
  }

  // Seed promotional category "acties"
  console.log("Seeding promotional categories...");
  const promoCat = await prisma.category.create({
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
    }
  });

  // Seed products
  console.log("Seeding products, variants and image links...");
  const usedSkus = new Set<string>();

  for (const pData of parsedProducts) {
    const catSlug = slugify(pData.categoryName);
    const categoryId = categoryMap[catSlug];
    if (!categoryId) continue;

    // Generate unique and deterministic SKU if none extracted from filenames
    let sku = pData.sku;
    if (!sku) {
      const catAbbr = catSlug.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      const prodAbbr = pData.productFolderName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
      sku = `${catAbbr}-${prodAbbr}`;
    }

    let baseSku = sku;
    let counter = 1;
    while (usedSkus.has(sku)) {
      sku = `${baseSku}-${counter}`;
      counter++;
    }
    usedSkus.add(sku);

    const slug = slugify(pData.productFolderName);
    const productName = pData.productFolderName;

    // Define smart, category-based pricing structure (in cents)
    let price250 = 295;
    let price500 = 495;

    if (catSlug.includes("pinda")) {
      price250 = 250;
      price500 = 395;
    } else if (catSlug.includes("noten") || catSlug.includes("mix")) {
      price250 = 395;
      price500 = 695;
    } else if (catSlug.includes("chocolade")) {
      price250 = 350;
      price500 = 595;
    } else if (catSlug.includes("pitten") || catSlug.includes("zaden")) {
      price250 = 225;
      price500 = 350;
    }

    // Determine smart attributes based on text
    const lowerName = productName.toLowerCase();
    const preparation: Preparation = (lowerName.includes("geroosterd") || lowerName.includes("gebrand")) ? "ROASTED" : "RAW";
    const salting: Salting = (lowerName.includes("gezouten") || lowerName.includes("zout")) ? "SALTED" : "UNSALTED";
    const coating: Coating = catSlug.includes("chocolade") ? "CHOCOLATE" : "NONE";

    const createdProduct = await prisma.product.create({
      data: {
        slug,
        sku,
        basePriceCents: price500,
        translations: {
          create: locales.map((locale) => ({
            locale,
            name: productName,
            slug,
            description: `${productName} van De Notenman. Vers en ambachtelijk verpakt.`,
          })),
        },
        variants: {
          create: [
            {
              sku: `${sku}-250G`,
              priceCents: price250,
              weightGrams: 250,
              preparation,
              salting,
              coating,
              translations: {
                create: locales.map((locale) => ({
                  locale,
                  label: "250 g",
                })),
              },
            },
            {
              sku: `${sku}-500G`,
              priceCents: price500,
              weightGrams: 500,
              preparation,
              salting,
              coating,
              translations: {
                create: locales.map((locale) => ({
                  locale,
                  label: "500 g",
                })),
              },
            },
          ]
        }
      }
    });

    // Link product to category
    await prisma.productCategory.create({
      data: {
        productId: createdProduct.id,
        categoryId: categoryId,
      }
    });

    // Seed product images
    let sortIdx = 0;
    for (const imgKey of pData.images) {
      await prisma.productImage.create({
        data: {
          productId: createdProduct.id,
          storageKey: imgKey,
          alt: productName,
          sortOrder: sortIdx++,
          isPrimary: sortIdx === 1,
        }
      });
    }
  }

  console.log(`Seeded ${parsedProducts.length} live products successfully.`);

  // Seed pages
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
