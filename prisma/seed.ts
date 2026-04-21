import { PrismaClient, ProductStatus, ShippingCountry, UserRole } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

type CategorySeed = {
  slug: string;
  name: string;
  children?: CategorySeed[];
};

const CATEGORIES: CategorySeed[] = [
  {
    slug: "noten",
    name: "Noten",
    children: [
      { slug: "amandelen", name: "Amandelen" },
      { slug: "cashewnoten", name: "Cashewnoten" },
      { slug: "walnoten", name: "Walnoten" },
      { slug: "hazelnoten", name: "Hazelnoten" },
      { slug: "pecannoten", name: "Pecannoten" },
      { slug: "pistaches", name: "Pistaches" },
      { slug: "macadamianoten", name: "Macadamianoten" },
      { slug: "paranoten", name: "Paranoten" },
      { slug: "gemengde-noten", name: "Gemengde noten" },
      { slug: "pindas", name: "Pinda's" },
    ],
  },
  {
    slug: "gedroogd-fruit",
    name: "Gedroogd Fruit",
    children: [
      { slug: "dadels", name: "Dadels" },
      { slug: "abrikozen", name: "Abrikozen" },
      { slug: "vijgen", name: "Vijgen" },
      { slug: "cranberrys", name: "Cranberry's" },
      { slug: "gojibessen", name: "Gojibessen" },
      { slug: "moerbeien", name: "Moerbeien" },
      { slug: "zuurbessen", name: "Zuurbessen" },
      { slug: "rozijnen", name: "Rozijnen" },
      { slug: "gember", name: "Gember" },
      { slug: "bananen", name: "Bananen" },
      { slug: "ananas", name: "Ananas" },
    ],
  },
  {
    slug: "pitten-en-zaden",
    name: "Pitten & Zaden",
    children: [
      { slug: "chiazaad", name: "Chiazaad" },
      { slug: "lijnzaad", name: "Lijnzaad" },
      { slug: "pompoenpitten", name: "Pompoenpitten" },
      { slug: "zonnebloempitten", name: "Zonnebloempitten" },
      { slug: "pijnboompitten", name: "Pijnboompitten" },
      { slug: "sesamzaad", name: "Sesamzaad" },
      { slug: "quinoa", name: "Quinoa" },
      { slug: "salademix", name: "Salademix" },
    ],
  },
  {
    slug: "natuurvoeding",
    name: "Natuurvoeding",
    children: [
      { slug: "honing", name: "Honing" },
      { slug: "superfoods", name: "Superfoods" },
    ],
  },
  {
    slug: "snacks",
    name: "Snacks",
    children: [
      { slug: "pindarotsjes", name: "Pindarotsjes" },
      { slug: "crackers-zoutjes", name: "Crackers & Zoutjes" },
      { slug: "gevriesdroogde-chocolade", name: "Gevriesdroogde vruchten met chocolade" },
      { slug: "bananenchips", name: "Bananenchips" },
    ],
  },
  { slug: "bakproducten", name: "Bakproducten" },
  {
    slug: "healthy-disks",
    name: "Healthy Disks",
    children: [
      { slug: "dadel-kokos", name: "Dadel-Kokos" },
      { slug: "pruim-cranberry", name: "Pruim-Cranberry" },
      { slug: "notenmix", name: "Notenmix-varianten" },
    ],
  },
];

async function seedCategories(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const [rootIndex, root] of CATEGORIES.entries()) {
    const parent = await prisma.category.upsert({
      where: { parentId_slug: { parentId: null as unknown as string, slug: root.slug } },
      update: { name: root.name, sortOrder: rootIndex },
      create: { slug: root.slug, name: root.name, sortOrder: rootIndex },
    });
    map.set(root.slug, parent.id);

    if (!root.children) continue;

    for (const [childIndex, child] of root.children.entries()) {
      const created = await prisma.category.upsert({
        where: { parentId_slug: { parentId: parent.id, slug: child.slug } },
        update: { name: child.name, sortOrder: childIndex },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: parent.id,
          sortOrder: childIndex,
        },
      });
      map.set(`${root.slug}/${child.slug}`, created.id);
    }
  }

  return map;
}

type ProductSeed = {
  sku: string;
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  tasteNotes: string;
  usageTip: string;
  origin?: string;
  harvestYear?: number;
  roasted?: boolean;
  organic?: boolean;
  allergens?: string[];
  variants: { sku: string; name: string; weightGrams: number; priceCents: number; stock: number }[];
};

const PRODUCTS: ProductSeed[] = [
  {
    sku: "AMD-SPA-ROAST",
    slug: "amandelen-spanje-gebrand",
    name: "Amandelen Spanje, vers gebrand",
    categorySlug: "noten/amandelen",
    description: "Hele amandelen uit Spanje, vers gebrand in eigen huis.",
    tasteNotes: "Vol, licht geroosterd. Extra crunchy.",
    usageTip: "In havermout, yoghurt of als topping.",
    origin: "Spanje",
    harvestYear: 2025,
    roasted: true,
    allergens: ["noten"],
    variants: [
      { sku: "AMD-SPA-ROAST-250", name: "250 g", weightGrams: 250, priceCents: 495, stock: 40 },
      { sku: "AMD-SPA-ROAST-500", name: "500 g", weightGrams: 500, priceCents: 895, stock: 30 },
      { sku: "AMD-SPA-ROAST-1000", name: "1 kg", weightGrams: 1000, priceCents: 1695, stock: 15 },
    ],
  },
  {
    sku: "CASH-VN-RAW",
    slug: "cashewnoten-ongebrand",
    name: "Cashewnoten, ongebrand",
    categorySlug: "noten/cashewnoten",
    description: "Hele cashewnoten, ongebrand en ongezouten.",
    tasteNotes: "Zacht, licht zoet. Smeuïge textuur.",
    usageTip: "Door salades of als basis voor cashewroom.",
    origin: "Vietnam",
    harvestYear: 2025,
    roasted: false,
    allergens: ["noten"],
    variants: [
      { sku: "CASH-VN-RAW-250", name: "250 g", weightGrams: 250, priceCents: 525, stock: 30 },
      { sku: "CASH-VN-RAW-500", name: "500 g", weightGrams: 500, priceCents: 950, stock: 25 },
    ],
  },
  {
    sku: "WAL-FR-RAW",
    slug: "walnoten-frankrijk",
    name: "Walnoten, Frankrijk",
    categorySlug: "noten/walnoten",
    description: "Licht en mild van smaak. Uit Franse boomgaarden.",
    tasteNotes: "Romig, licht bitter in de nasmaak.",
    usageTip: "Over salade of in bananenbrood.",
    origin: "Frankrijk",
    harvestYear: 2024,
    allergens: ["noten"],
    variants: [
      { sku: "WAL-FR-RAW-250", name: "250 g", weightGrams: 250, priceCents: 575, stock: 20 },
      { sku: "WAL-FR-RAW-500", name: "500 g", weightGrams: 500, priceCents: 1050, stock: 15 },
    ],
  },
  {
    sku: "HAZ-IT-ROAST",
    slug: "hazelnoten-gebrand",
    name: "Hazelnoten, gebrand",
    categorySlug: "noten/hazelnoten",
    description: "Italiaanse hazelnoten, vers gebrand.",
    tasteNotes: "Intens, nootachtig, licht zoet.",
    usageTip: "In zelfgemaakte notenpasta of over ijs.",
    origin: "Italië",
    roasted: true,
    allergens: ["noten"],
    variants: [
      { sku: "HAZ-IT-ROAST-250", name: "250 g", weightGrams: 250, priceCents: 595, stock: 25 },
      { sku: "HAZ-IT-ROAST-500", name: "500 g", weightGrams: 500, priceCents: 1095, stock: 18 },
    ],
  },
  {
    sku: "PEC-US-RAW",
    slug: "pecannoten",
    name: "Pecannoten",
    categorySlug: "noten/pecannoten",
    description: "Hele pecannoten.",
    tasteNotes: "Boterachtig, mild zoet.",
    usageTip: "In ovenschotels of pecan pie.",
    origin: "Verenigde Staten",
    allergens: ["noten"],
    variants: [
      { sku: "PEC-US-RAW-250", name: "250 g", weightGrams: 250, priceCents: 650, stock: 20 },
    ],
  },
  {
    sku: "PIS-IR-ROAST",
    slug: "pistaches-gezouten",
    name: "Pistaches, geroosterd & gezouten",
    categorySlug: "noten/pistaches",
    description: "Iraanse pistaches in de schil.",
    tasteNotes: "Stevig, zilt, diepe smaak.",
    usageTip: "Als borrelhap.",
    origin: "Iran",
    roasted: true,
    allergens: ["noten"],
    variants: [
      { sku: "PIS-IR-ROAST-250", name: "250 g", weightGrams: 250, priceCents: 695, stock: 30 },
      { sku: "PIS-IR-ROAST-500", name: "500 g", weightGrams: 500, priceCents: 1295, stock: 20 },
    ],
  },
  {
    sku: "DAT-MEJ-JO",
    slug: "medjoul-dadels-jordanie",
    name: "Medjoul dadels, Jordanië",
    categorySlug: "gedroogd-fruit/dadels",
    description: "Grote, zachte Medjoul dadels.",
    tasteNotes: "Karamelachtig, honingzoet, vlezig.",
    usageTip: "Puur, gevuld met pindakaas, of in energy balls.",
    origin: "Jordanië",
    harvestYear: 2025,
    variants: [
      { sku: "DAT-MEJ-JO-500", name: "500 g", weightGrams: 500, priceCents: 895, stock: 40 },
      { sku: "DAT-MEJ-JO-1000", name: "1 kg", weightGrams: 1000, priceCents: 1695, stock: 25 },
    ],
  },
  {
    sku: "DAT-DEG-TN",
    slug: "deglet-dadels",
    name: "Deglet Noor dadels",
    categorySlug: "gedroogd-fruit/dadels",
    description: "Stevige, iets minder zoete dadels.",
    tasteNotes: "Mild zoet, licht kauwend.",
    usageTip: "In ontbijtgranen of bakrecepten.",
    origin: "Tunesië",
    variants: [
      { sku: "DAT-DEG-TN-500", name: "500 g", weightGrams: 500, priceCents: 595, stock: 35 },
    ],
  },
  {
    sku: "ABR-TR-SWEET",
    slug: "abrikozen-zoet",
    name: "Abrikozen, zoet",
    categorySlug: "gedroogd-fruit/abrikozen",
    description: "Gedroogde zoete abrikozen.",
    tasteNotes: "Fris-zoet, sappig.",
    usageTip: "Als tussendoortje.",
    origin: "Turkije",
    variants: [
      { sku: "ABR-TR-SWEET-500", name: "500 g", weightGrams: 500, priceCents: 695, stock: 30 },
    ],
  },
  {
    sku: "CRB-CA",
    slug: "cranberrys-gezoet",
    name: "Cranberry's, licht gezoet",
    categorySlug: "gedroogd-fruit/cranberrys",
    description: "Gedroogde cranberry's.",
    tasteNotes: "Zoetzuur, stevig van textuur.",
    usageTip: "In mueslirepen of over salade.",
    origin: "Canada",
    variants: [
      { sku: "CRB-CA-250", name: "250 g", weightGrams: 250, priceCents: 395, stock: 40 },
      { sku: "CRB-CA-500", name: "500 g", weightGrams: 500, priceCents: 725, stock: 25 },
    ],
  },
  {
    sku: "CHIA-PE",
    slug: "chiazaad",
    name: "Chiazaad",
    categorySlug: "pitten-en-zaden/chiazaad",
    description: "Zwart chiazaad.",
    tasteNotes: "Neutraal. Zwelt op in vocht.",
    usageTip: "In chiapudding of smoothies.",
    origin: "Peru",
    organic: true,
    variants: [
      { sku: "CHIA-PE-250", name: "250 g", weightGrams: 250, priceCents: 295, stock: 50 },
      { sku: "CHIA-PE-500", name: "500 g", weightGrams: 500, priceCents: 525, stock: 30 },
    ],
  },
  {
    sku: "LIJN-NL-BROKEN",
    slug: "lijnzaad-gebroken",
    name: "Lijnzaad, gebroken",
    categorySlug: "pitten-en-zaden/lijnzaad",
    description: "Gebroken lijnzaad.",
    tasteNotes: "Mild, licht notig.",
    usageTip: "Door yoghurt of havermout.",
    origin: "Nederland",
    variants: [
      { sku: "LIJN-NL-BROKEN-500", name: "500 g", weightGrams: 500, priceCents: 175, stock: 60 },
    ],
  },
  {
    sku: "PUMP-CN",
    slug: "pompoenpitten",
    name: "Pompoenpitten",
    categorySlug: "pitten-en-zaden/pompoenpitten",
    description: "Groene pompoenpitten.",
    tasteNotes: "Nootachtig, crunchy.",
    usageTip: "Over soep of salade.",
    origin: "China",
    variants: [
      { sku: "PUMP-CN-250", name: "250 g", weightGrams: 250, priceCents: 295, stock: 45 },
      { sku: "PUMP-CN-500", name: "500 g", weightGrams: 500, priceCents: 525, stock: 30 },
    ],
  },
  {
    sku: "QUIN-PE-WHT",
    slug: "quinoa-wit",
    name: "Quinoa, wit",
    categorySlug: "pitten-en-zaden/quinoa",
    description: "Witte quinoa.",
    tasteNotes: "Neutraal, licht grassig.",
    usageTip: "Als basis voor salades of bowls.",
    origin: "Peru",
    organic: true,
    variants: [
      { sku: "QUIN-PE-WHT-500", name: "500 g", weightGrams: 500, priceCents: 450, stock: 25 },
    ],
  },
  {
    sku: "HON-NL-KOOL",
    slug: "koolzaadhoning",
    name: "Koolzaadhoning",
    categorySlug: "natuurvoeding/honing",
    description: "Romige koolzaadhoning.",
    tasteNotes: "Mild, boterachtig, licht bloemig.",
    usageTip: "Op boterham of in thee.",
    origin: "Nederland",
    organic: true,
    variants: [
      { sku: "HON-NL-KOOL-500", name: "500 g", weightGrams: 500, priceCents: 1095, stock: 20 },
    ],
  },
  {
    sku: "PIN-MILK",
    slug: "pindarotsjes-melkchocolade",
    name: "Pindarotsjes, melkchocolade",
    categorySlug: "snacks/pindarotsjes",
    description: "Ambachtelijke pindarotsjes in melkchocolade.",
    tasteNotes: "Zoet, zilt, knapperig.",
    usageTip: "Als zoete snack.",
    allergens: ["noten", "melk", "soja"],
    variants: [
      { sku: "PIN-MILK-200", name: "200 g", weightGrams: 200, priceCents: 495, stock: 40 },
    ],
  },
  {
    sku: "PIN-DARK",
    slug: "pindarotsjes-puur",
    name: "Pindarotsjes, pure chocolade",
    categorySlug: "snacks/pindarotsjes",
    description: "Pindarotsjes in pure chocolade.",
    tasteNotes: "Intens cacao, zilt, knapperig.",
    usageTip: "Als zoete snack.",
    allergens: ["noten", "soja"],
    variants: [
      { sku: "PIN-DARK-200", name: "200 g", weightGrams: 200, priceCents: 495, stock: 35 },
    ],
  },
  {
    sku: "BAN-PH-CHIP",
    slug: "bananenchips",
    name: "Bananenchips",
    categorySlug: "snacks/bananenchips",
    description: "Gedroogde bananenchips.",
    tasteNotes: "Zoet, knapperig.",
    usageTip: "In muesli of puur.",
    origin: "Filipijnen",
    variants: [
      { sku: "BAN-PH-CHIP-250", name: "250 g", weightGrams: 250, priceCents: 245, stock: 50 },
    ],
  },
  {
    sku: "HD-DAT-COC",
    slug: "healthy-disks-dadel-kokos",
    name: "Healthy Disks Dadel-Kokos",
    categorySlug: "healthy-disks/dadel-kokos",
    description: "Dadel-kokos repen.",
    tasteNotes: "Zoet, tropisch, vezelrijk.",
    usageTip: "Snelle energie voor onderweg.",
    variants: [
      { sku: "HD-DAT-COC-200", name: "200 g", weightGrams: 200, priceCents: 495, stock: 25 },
    ],
  },
  {
    sku: "HD-PRU-CRB",
    slug: "healthy-disks-pruim-cranberry",
    name: "Healthy Disks Pruim-Cranberry",
    categorySlug: "healthy-disks/pruim-cranberry",
    description: "Pruim-cranberry repen.",
    tasteNotes: "Zoetzuur, vol.",
    usageTip: "Na het sporten.",
    variants: [
      { sku: "HD-PRU-CRB-200", name: "200 g", weightGrams: 200, priceCents: 495, stock: 25 },
    ],
  },
];

async function seedProducts(categoryMap: Map<string, string>): Promise<void> {
  for (const p of PRODUCTS) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found: ${p.categorySlug}`);
    }

    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
        tasteNotes: p.tasteNotes,
        usageTip: p.usageTip,
        origin: p.origin ?? null,
        harvestYear: p.harvestYear ?? null,
        roasted: p.roasted ?? null,
        organic: p.organic ?? false,
        allergens: p.allergens ?? [],
        status: ProductStatus.active,
        categoryId,
      },
      create: {
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        description: p.description,
        tasteNotes: p.tasteNotes,
        usageTip: p.usageTip,
        origin: p.origin ?? null,
        harvestYear: p.harvestYear ?? null,
        roasted: p.roasted ?? null,
        organic: p.organic ?? false,
        allergens: p.allergens ?? [],
        status: ProductStatus.active,
        categoryId,
        variants: {
          create: p.variants.map((v, i) => ({
            sku: v.sku,
            name: v.name,
            weightGrams: v.weightGrams,
            priceCents: v.priceCents,
            stockQuantity: v.stock,
            position: i,
          })),
        },
      },
    });
  }
}

async function seedUsers(): Promise<void> {
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!ownerPassword || !adminPassword) {
    console.warn("SEED_OWNER_PASSWORD or SEED_ADMIN_PASSWORD not set, skipping user seed");
    return;
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@denotenman.nl";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@denotenman.nl";

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      passwordHash: await argon2.hash(ownerPassword, { memoryCost: 19456, timeCost: 2 }),
      role: UserRole.owner,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword, { memoryCost: 19456, timeCost: 2 }),
      role: UserRole.admin,
      emailVerifiedAt: new Date(),
    },
  });
}

async function seedShippingRules(): Promise<void> {
  const rules = [
    {
      country: ShippingCountry.NL,
      name: "PostNL standaard",
      baseCostCents: 495,
      freeAboveCents: 4000,
      estimatedDays: 2,
    },
    {
      country: ShippingCountry.BE,
      name: "PostNL België",
      baseCostCents: 795,
      freeAboveCents: 5000,
      estimatedDays: 3,
    },
  ];

  for (const rule of rules) {
    await prisma.shippingRule.upsert({
      where: { country_name: { country: rule.country, name: rule.name } },
      update: rule,
      create: rule,
    });
  }
}

async function main(): Promise<void> {
  const categoryMap = await seedCategories();
  await seedProducts(categoryMap);
  await seedUsers();
  await seedShippingRules();
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
