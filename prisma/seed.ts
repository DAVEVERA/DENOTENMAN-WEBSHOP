import { PrismaClient } from "@prisma/client";
import { pageKeys, pageSlugs } from "../lib/pages";

const prisma = new PrismaClient();

const locales = ["nl", "en", "fr"] as const;

const categorySeeds = [
  {
    slug: "noten",
    sortOrder: 1,
    translations: {
      nl: { name: "Noten", slug: "noten" },
      en: { name: "Nuts", slug: "nuts" },
      fr: { name: "Noix", slug: "noix" },
    },
    product: {
      slug: "amandelen-spanje",
      sku: "NOT-AMA-ES",
      basePriceCents: 695,
      translations: {
        nl: {
          name: "Amandelen, Spanje",
          slug: "amandelen-spanje",
          description: "Hele amandelen uit Spanje, vers gebrand in eigen huis.",
        },
        en: {
          name: "Almonds, Spain",
          slug: "almonds-spain",
          description: "Whole almonds from Spain, roasted in-house.",
        },
        fr: {
          name: "Amandes, Espagne",
          slug: "amandes-espagne",
          description: "Amandes entières d'Espagne, torréfiées sur place.",
        },
      },
      variants: [
        {
          sku: "NOT-AMA-ES-250-ROA-SAL",
          priceCents: 395,
          weightGrams: 250,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "NONE",
          labels: { nl: "250 g, geroosterd, gezouten", en: "250 g, roasted, salted", fr: "250 g, torréfié, salé" },
        },
        {
          sku: "NOT-AMA-ES-500-ROA-SAL",
          priceCents: 695,
          weightGrams: 500,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "NONE",
          labels: { nl: "500 g, geroosterd, gezouten", en: "500 g, roasted, salted", fr: "500 g, torréfié, salé" },
        },
      ],
    },
  },
  {
    slug: "pindas",
    sortOrder: 2,
    translations: {
      nl: { name: "Pinda's", slug: "pindas" },
      en: { name: "Peanuts", slug: "peanuts" },
      fr: { name: "Cacahuètes", slug: "cacahuetes" },
    },
    product: {
      slug: "pindas-naturel",
      sku: "PIN-NAT",
      basePriceCents: 395,
      translations: {
        nl: {
          name: "Pinda's naturel",
          slug: "pindas-naturel",
          description: "Pinda's zonder toevoegingen, geroosterd in eigen huis.",
        },
        en: {
          name: "Peanuts, plain",
          slug: "peanuts-plain",
          description: "Peanuts without additions, roasted in-house.",
        },
        fr: {
          name: "Cacahuètes nature",
          slug: "cacahuetes-nature",
          description: "Cacahuètes sans additifs, torréfiées sur place.",
        },
      },
      variants: [
        {
          sku: "PIN-NAT-250-ROA-UNS",
          priceCents: 250,
          weightGrams: 250,
          preparation: "ROASTED",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "250 g, geroosterd, ongezouten", en: "250 g, roasted, unsalted", fr: "250 g, torréfié, non salé" },
        },
        {
          sku: "PIN-NAT-500-ROA-SAL",
          priceCents: 395,
          weightGrams: 500,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "NONE",
          labels: { nl: "500 g, geroosterd, gezouten", en: "500 g, roasted, salted", fr: "500 g, torréfié, salé" },
        },
      ],
    },
  },
  {
    slug: "notenmixen",
    sortOrder: 3,
    translations: {
      nl: { name: "Notenmixen", slug: "notenmixen" },
      en: { name: "Nut mixes", slug: "nut-mixes" },
      fr: { name: "Mélanges de noix", slug: "melanges-de-noix" },
    },
    product: {
      slug: "borrelmix",
      sku: "MIX-BORREL",
      basePriceCents: 595,
      translations: {
        nl: {
          name: "Borrelmix",
          slug: "borrelmix",
          description: "Mix van noten en pinda's, geroosterd en gezouten.",
        },
        en: {
          name: "Party mix",
          slug: "party-mix",
          description: "Mix of nuts and peanuts, roasted and salted.",
        },
        fr: {
          name: "Mélange apéritif",
          slug: "melange-aperitif",
          description: "Mélange de noix et cacahuètes, torréfié et salé.",
        },
      },
      variants: [
        {
          sku: "MIX-BORREL-250-ROA-SAL",
          priceCents: 350,
          weightGrams: 250,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "NONE",
          labels: { nl: "250 g, geroosterd, gezouten", en: "250 g, roasted, salted", fr: "250 g, torréfié, salé" },
        },
        {
          sku: "MIX-BORREL-500-ROA-SAL",
          priceCents: 595,
          weightGrams: 500,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "NONE",
          labels: { nl: "500 g, geroosterd, gezouten", en: "500 g, roasted, salted", fr: "500 g, torréfié, salé" },
        },
      ],
    },
  },
  {
    slug: "pitten-zaden",
    sortOrder: 4,
    translations: {
      nl: { name: "Pitten & zaden", slug: "pitten-zaden" },
      en: { name: "Seeds", slug: "seeds" },
      fr: { name: "Graines", slug: "graines" },
    },
    product: {
      slug: "pompoenpitten",
      sku: "ZAA-POMP",
      basePriceCents: 350,
      translations: {
        nl: {
          name: "Pompoenpitten",
          slug: "pompoenpitten",
          description: "Ongebrande pompoenpitten, naturel.",
        },
        en: {
          name: "Pumpkin seeds",
          slug: "pumpkin-seeds",
          description: "Raw pumpkin seeds, plain.",
        },
        fr: {
          name: "Graines de courge",
          slug: "graines-de-courge",
          description: "Graines de courge crues, nature.",
        },
      },
      variants: [
        {
          sku: "ZAA-POMP-250-RAW-UNS",
          priceCents: 225,
          weightGrams: 250,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "250 g, ongebrand, ongezouten", en: "250 g, raw, unsalted", fr: "250 g, cru, non salé" },
        },
        {
          sku: "ZAA-POMP-500-RAW-UNS",
          priceCents: 350,
          weightGrams: 500,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "500 g, ongebrand, ongezouten", en: "500 g, raw, unsalted", fr: "500 g, cru, non salé" },
        },
      ],
    },
  },
  {
    slug: "gedroogd-fruit",
    sortOrder: 5,
    translations: {
      nl: { name: "Gedroogd fruit", slug: "gedroogd-fruit" },
      en: { name: "Dried fruit", slug: "dried-fruit" },
      fr: { name: "Fruits secs", slug: "fruits-secs" },
    },
    product: {
      slug: "gedroogde-abrikozen",
      sku: "FRU-ABRI",
      basePriceCents: 450,
      translations: {
        nl: {
          name: "Gedroogde abrikozen",
          slug: "gedroogde-abrikozen",
          description: "Gedroogde abrikozen zonder toegevoegde suiker.",
        },
        en: {
          name: "Dried apricots",
          slug: "dried-apricots",
          description: "Dried apricots without added sugar.",
        },
        fr: {
          name: "Abricots séchés",
          slug: "abricots-seches",
          description: "Abricots séchés sans sucre ajouté.",
        },
      },
      variants: [
        {
          sku: "FRU-ABRI-250-RAW-UNS",
          priceCents: 295,
          weightGrams: 250,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "250 g", en: "250 g", fr: "250 g" },
        },
        {
          sku: "FRU-ABRI-500-RAW-UNS",
          priceCents: 450,
          weightGrams: 500,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "500 g", en: "500 g", fr: "500 g" },
        },
      ],
    },
  },
  {
    slug: "chocolade",
    sortOrder: 6,
    translations: {
      nl: { name: "Chocolade", slug: "chocolade" },
      en: { name: "Chocolate", slug: "chocolate" },
      fr: { name: "Chocolat", slug: "chocolat" },
    },
    product: {
      slug: "amandelen-melkchocolade",
      sku: "CHO-AMA-MELK",
      basePriceCents: 595,
      translations: {
        nl: {
          name: "Amandelen in melkchocolade",
          slug: "amandelen-melkchocolade",
          description: "Amandelen omhuld met melkchocolade.",
        },
        en: {
          name: "Almonds in milk chocolate",
          slug: "almonds-milk-chocolate",
          description: "Almonds coated in milk chocolate.",
        },
        fr: {
          name: "Amandes au chocolat au lait",
          slug: "amandes-chocolat-au-lait",
          description: "Amandes enrobées de chocolat au lait.",
        },
      },
      variants: [
        {
          sku: "CHO-AMA-MELK-250-ROA-UNS",
          priceCents: 350,
          weightGrams: 250,
          preparation: "ROASTED",
          salting: "UNSALTED",
          coating: "CHOCOLATE",
          labels: { nl: "250 g", en: "250 g", fr: "250 g" },
        },
        {
          sku: "CHO-AMA-MELK-500-ROA-UNS",
          priceCents: 595,
          weightGrams: 500,
          preparation: "ROASTED",
          salting: "UNSALTED",
          coating: "CHOCOLATE",
          labels: { nl: "500 g", en: "500 g", fr: "500 g" },
        },
      ],
    },
  },
  {
    slug: "bakproducten",
    sortOrder: 7,
    translations: {
      nl: { name: "Bakproducten", slug: "bakproducten" },
      en: { name: "Baking products", slug: "baking-products" },
      fr: { name: "Produits de pâtisserie", slug: "produits-de-patisserie" },
    },
    product: {
      slug: "amandelschaafsel",
      sku: "BAK-AMA-SCHAAF",
      basePriceCents: 350,
      translations: {
        nl: {
          name: "Amandelschaafsel",
          slug: "amandelschaafsel",
          description: "Fijn geschaafde amandelen, geschikt om te bakken.",
        },
        en: {
          name: "Flaked almonds",
          slug: "flaked-almonds",
          description: "Finely flaked almonds, suitable for baking.",
        },
        fr: {
          name: "Amandes effilées",
          slug: "amandes-effilees",
          description: "Amandes finement effilées, adaptées à la pâtisserie.",
        },
      },
      variants: [
        {
          sku: "BAK-AMA-SCHAAF-250-RAW-UNS",
          priceCents: 225,
          weightGrams: 250,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "250 g", en: "250 g", fr: "250 g" },
        },
        {
          sku: "BAK-AMA-SCHAAF-500-RAW-UNS",
          priceCents: 350,
          weightGrams: 500,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          labels: { nl: "500 g", en: "500 g", fr: "500 g" },
        },
      ],
    },
  },
  {
    slug: "hartige-snacks",
    sortOrder: 8,
    translations: {
      nl: { name: "Hartige snacks", slug: "hartige-snacks" },
      en: { name: "Savoury snacks", slug: "savoury-snacks" },
      fr: { name: "Snacks salés", slug: "snacks-sales" },
    },
    product: {
      slug: "wasabi-erwten",
      sku: "SNK-WASABI",
      basePriceCents: 350,
      translations: {
        nl: {
          name: "Wasabi-erwten",
          slug: "wasabi-erwten",
          description: "Krokante erwten met wasabismaak.",
        },
        en: {
          name: "Wasabi peas",
          slug: "wasabi-peas",
          description: "Crunchy peas with wasabi flavour.",
        },
        fr: {
          name: "Pois wasabi",
          slug: "pois-wasabi",
          description: "Pois croquants au goût wasabi.",
        },
      },
      variants: [
        {
          sku: "SNK-WASABI-250-ROA-FLA",
          priceCents: 225,
          weightGrams: 250,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "FLAVORED",
          labels: { nl: "250 g", en: "250 g", fr: "250 g" },
        },
        {
          sku: "SNK-WASABI-500-ROA-FLA",
          priceCents: 350,
          weightGrams: 500,
          preparation: "ROASTED",
          salting: "SALTED",
          coating: "FLAVORED",
          labels: { nl: "500 g", en: "500 g", fr: "500 g" },
        },
      ],
    },
  },
] as const;

const promotionalCategory = {
  slug: "acties",
  translations: {
    nl: { name: "Acties", slug: "acties" },
    en: { name: "Deals", slug: "deals" },
    fr: { name: "Promotions", slug: "promotions" },
  },
};

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

async function seedPromotionalCategory() {
  await prisma.category.upsert({
    where: { slug: promotionalCategory.slug },
    create: {
      slug: promotionalCategory.slug,
      type: "PROMOTIONAL",
      sortOrder: 0,
      translations: {
        create: locales.map((locale) => ({
          locale,
          name: promotionalCategory.translations[locale].name,
          slug: promotionalCategory.translations[locale].slug,
        })),
      },
    },
    update: {},
  });
}

async function seedCategoryWithProduct(category: (typeof categorySeeds)[number]) {
  const createdCategory = await prisma.category.upsert({
    where: { slug: category.slug },
    create: {
      slug: category.slug,
      type: "STANDARD",
      sortOrder: category.sortOrder,
      translations: {
        create: locales.map((locale) => ({
          locale,
          name: category.translations[locale].name,
          slug: category.translations[locale].slug,
        })),
      },
    },
    update: {},
  });

  const product = category.product;

  const createdProduct = await prisma.product.upsert({
    where: { slug: product.slug },
    create: {
      slug: product.slug,
      sku: product.sku,
      basePriceCents: product.basePriceCents,
      translations: {
        create: locales.map((locale) => ({
          locale,
          name: product.translations[locale].name,
          slug: product.translations[locale].slug,
          description: product.translations[locale].description,
        })),
      },
      variants: {
        create: product.variants.map((variant) => ({
          sku: variant.sku,
          priceCents: variant.priceCents,
          weightGrams: variant.weightGrams,
          preparation: variant.preparation,
          salting: variant.salting,
          coating: variant.coating,
          translations: {
            create: locales.map((locale) => ({
              locale,
              label: variant.labels[locale],
            })),
          },
        })),
      },
    },
    update: {},
  });

  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: {
        productId: createdProduct.id,
        categoryId: createdCategory.id,
      },
    },
    create: {
      productId: createdProduct.id,
      categoryId: createdCategory.id,
    },
    update: {},
  });
}

async function seedPages() {
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
  await seedPromotionalCategory();

  for (const category of categorySeeds) {
    await seedCategoryWithProduct(category);
  }

  await seedPages();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
