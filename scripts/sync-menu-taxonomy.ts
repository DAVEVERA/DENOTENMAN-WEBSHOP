import { PrismaClient, type Locale, type Prisma } from "@prisma/client";
import { collectCategoryAndAncestorIds } from "../lib/category-hierarchy";
import {
  getChocolatePlacementForProductSku,
  getNutFamilyForProductSku,
} from "../lib/catalog-taxonomy";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

type Translation = { name: string; slug: string; description: string };
type CategoryDefinition = {
  slug: string;
  parentSlug: string | null;
  sortOrder: number;
  translations: Record<Locale, Translation>;
};

const definitions: CategoryDefinition[] = [
  {
    slug: "amandelen", parentSlug: "noten", sortOrder: 1,
    translations: {
      nl: { name: "Amandelen", slug: "amandelen", description: "Bruine en witte amandelen, gebrand of ongebrand." },
      en: { name: "Almonds", slug: "almonds", description: "Brown and blanched almonds, roasted or raw." },
      fr: { name: "Amandes", slug: "amandes", description: "Amandes brunes et blanches, grillees ou crues." },
    },
  },
  {
    slug: "cashewnoten", parentSlug: "noten", sortOrder: 2,
    translations: {
      nl: { name: "Cashewnoten", slug: "cashewnoten", description: "Cashewnoten, gebrand, ongebrand of met vlies." },
      en: { name: "Cashews", slug: "cashews", description: "Cashews, roasted, raw or with their skin." },
      fr: { name: "Noix de cajou", slug: "noix-de-cajou", description: "Noix de cajou grillees, crues ou avec leur peau." },
    },
  },
  {
    slug: "hazelnoten", parentSlug: "noten", sortOrder: 3,
    translations: {
      nl: { name: "Hazelnoten", slug: "hazelnoten", description: "Bruine en witte hazelnoten, gebrand of ongebrand." },
      en: { name: "Hazelnuts", slug: "hazelnuts", description: "Brown and blanched hazelnuts, roasted or raw." },
      fr: { name: "Noisettes", slug: "noisettes", description: "Noisettes brunes et blanches, grillees ou crues." },
    },
  },
  {
    slug: "macadamias", parentSlug: "noten", sortOrder: 4,
    translations: {
      nl: { name: "Macadamia's", slug: "macadamias", description: "Macadamia's, gezouten, ongebrand of ongezouten." },
      en: { name: "Macadamias", slug: "macadamias", description: "Macadamias, salted, raw or unsalted." },
      fr: { name: "Noix de macadamia", slug: "noix-de-macadamia", description: "Noix de macadamia salees, crues ou non salees." },
    },
  },
  {
    slug: "paranoten", parentSlug: "noten", sortOrder: 5,
    translations: {
      nl: { name: "Paranoten", slug: "paranoten", description: "Volle, romige paranoten." },
      en: { name: "Brazil nuts", slug: "brazil-nuts", description: "Rich and creamy Brazil nuts." },
      fr: { name: "Noix du Bresil", slug: "noix-du-bresil", description: "Noix du Bresil riches et cremeuses." },
    },
  },
  {
    slug: "pecannoten", parentSlug: "noten", sortOrder: 6,
    translations: {
      nl: { name: "Pecannoten", slug: "pecannoten", description: "Pecannoten, gezouten, ongebrand of ongezouten." },
      en: { name: "Pecans", slug: "pecans", description: "Pecans, salted, raw or unsalted." },
      fr: { name: "Noix de pecan", slug: "noix-de-pecan", description: "Noix de pecan salees, crues ou non salees." },
    },
  },
  {
    slug: "walnoten", parentSlug: "noten", sortOrder: 7,
    translations: {
      nl: { name: "Walnoten", slug: "walnoten", description: "Gepelde walnoten en walnotenstukjes." },
      en: { name: "Walnuts", slug: "walnuts", description: "Shelled walnuts and walnut pieces." },
      fr: { name: "Noix", slug: "noix-cerneaux", description: "Cerneaux de noix et morceaux de noix." },
    },
  },
  {
    slug: "pistachenoten", parentSlug: "noten", sortOrder: 9,
    translations: {
      nl: { name: "Pistachenoten", slug: "pistachenoten", description: "Pistachenoten, gepeld, gebrand of gezouten." },
      en: { name: "Pistachios", slug: "pistachios", description: "Pistachios, shelled, roasted or salted." },
      fr: { name: "Pistaches", slug: "pistaches", description: "Pistaches decortiquees, grillees ou salees." },
    },
  },
  {
    slug: "losse-noten", parentSlug: "noten", sortOrder: 99,
    translations: {
      nl: { name: "Losse noten", slug: "losse-noten", description: "Amandelen, cashews, hazelnoten en andere losse noten." },
      en: { name: "Single nuts", slug: "single-nuts", description: "Almonds, cashews, hazelnuts and other single nuts." },
      fr: { name: "Noix nature", slug: "noix-nature", description: "Amandes, noix de cajou, noisettes et autres noix." },
    },
  },
  {
    slug: "chocolade", parentSlug: "chocolade-zoet", sortOrder: 1,
    translations: {
      nl: { name: "Chocolade", slug: "chocolade", description: "Chocoladenoten, rotsjes en flikken." },
      en: { name: "Chocolate", slug: "chocolate", description: "Chocolate-coated nuts, clusters and discs." },
      fr: { name: "Chocolat", slug: "chocolat", description: "Noix enrobees de chocolat, rochers et palets." },
    },
  },
  {
    slug: "chocolade-amandelen", parentSlug: "chocolade", sortOrder: 1,
    translations: {
      nl: { name: "Chocolade amandelen", slug: "chocolade-amandelen", description: "Amandelen met pure, melk-, witte of gearomatiseerde chocolade." },
      en: { name: "Chocolate almonds", slug: "chocolate-almonds", description: "Almonds coated in dark, milk, white or flavoured chocolate." },
      fr: { name: "Amandes au chocolat", slug: "amandes-chocolat", description: "Amandes enrobees de chocolat noir, au lait, blanc ou aromatise." },
    },
  },
  {
    slug: "chocolade-rotsjes", parentSlug: "chocolade", sortOrder: 2,
    translations: {
      nl: { name: "Chocolade rotsjes", slug: "chocolade-rotsjes", description: "Ambachtelijke chocolade rotsjes met cranberry of pinda." },
      en: { name: "Chocolate clusters", slug: "chocolate-clusters", description: "Handmade chocolate clusters with cranberry or peanuts." },
      fr: { name: "Rochers au chocolat", slug: "rochers-chocolat", description: "Rochers artisanaux au chocolat avec cranberries ou cacahuetes." },
    },
  },
  {
    slug: "chocolade-hazelnoten", parentSlug: "chocolade", sortOrder: 3,
    translations: {
      nl: { name: "Chocolade hazelnoten", slug: "chocolade-hazelnoten", description: "Hazelnoten omhuld met chocolade." },
      en: { name: "Chocolate hazelnuts", slug: "chocolate-hazelnuts", description: "Hazelnuts coated in chocolate." },
      fr: { name: "Noisettes au chocolat", slug: "noisettes-chocolat", description: "Noisettes enrobees de chocolat." },
    },
  },
  {
    slug: "chocolade-pecannoten", parentSlug: "chocolade", sortOrder: 4,
    translations: {
      nl: { name: "Chocolade pecannoten", slug: "chocolade-pecannoten", description: "Pecannoten gecombineerd met chocolade en truffelsmaak." },
      en: { name: "Chocolate pecans", slug: "chocolate-pecans", description: "Pecans combined with chocolate and truffle flavour." },
      fr: { name: "Noix de pecan au chocolat", slug: "noix-pecan-chocolat", description: "Noix de pecan au chocolat et saveur truffe." },
    },
  },
  {
    slug: "chocolade-pindas", parentSlug: "chocolade", sortOrder: 5,
    translations: {
      nl: { name: "Chocolade pinda's", slug: "chocolade-pindas", description: "Pinda's omhuld met melk- of pure chocolade." },
      en: { name: "Chocolate peanuts", slug: "chocolate-peanuts", description: "Peanuts coated in milk or dark chocolate." },
      fr: { name: "Cacahuetes au chocolat", slug: "cacahuetes-chocolat", description: "Cacahuetes enrobees de chocolat au lait ou noir." },
    },
  },
  {
    slug: "chocolade-rozijnen", parentSlug: "chocolade", sortOrder: 6,
    translations: {
      nl: { name: "Chocolade rozijnen", slug: "chocolade-rozijnen", description: "Rozijnen met melk-, pure, witte of yoghurtcoating." },
      en: { name: "Chocolate raisins", slug: "chocolate-raisins", description: "Raisins coated in milk, dark, white or yoghurt chocolate." },
      fr: { name: "Raisins au chocolat", slug: "raisins-chocolat", description: "Raisins enrobes de chocolat au lait, noir, blanc ou au yaourt." },
    },
  },
  {
    slug: "studenten-flikken", parentSlug: "chocolade", sortOrder: 7,
    translations: {
      nl: { name: "Studenten Flikken", slug: "studenten-flikken", description: "Chocoladeflikken met een rijk gevulde noten- en fruitmix." },
      en: { name: "Student chocolate discs", slug: "student-chocolate-discs", description: "Chocolate discs topped with a rich nut and fruit mix." },
      fr: { name: "Palets etudiants", slug: "palets-etudiants", description: "Palets au chocolat garnis d'un riche melange de noix et de fruits." },
    },
  },
  {
    slug: "zoet", parentSlug: "chocolade-zoet", sortOrder: 2,
    translations: {
      nl: { name: "Zoet", slug: "zoet", description: "Gedroogd fruit, gekonfijt fruit en andere zoetigheden." },
      en: { name: "Sweets", slug: "sweets", description: "Dried fruit, candied fruit and other sweets." },
      fr: { name: "Douceurs", slug: "douceurs", description: "Fruits seches, fruits confits et autres douceurs." },
    },
  },
  {
    slug: "snoep-nougat", parentSlug: "zoet", sortOrder: 3,
    translations: {
      nl: { name: "Snoep & nougat", slug: "snoep-nougat", description: "Nougat, marsepein en suikerwaren." },
      en: { name: "Candy & nougat", slug: "candy-nougat", description: "Nougat, marzipan and confectionery." },
      fr: { name: "Confiserie & nougat", slug: "confiserie-nougat", description: "Nougat, massepain et confiseries." },
    },
  },
  {
    slug: "fruitsnacks", parentSlug: "zoet", sortOrder: 4,
    translations: {
      nl: { name: "Fruitsnacks", slug: "fruitsnacks", description: "Knapperige en gevriesdroogde fruitsnacks." },
      en: { name: "Fruit snacks", slug: "fruit-snacks", description: "Crunchy and freeze-dried fruit snacks." },
      fr: { name: "Snacks aux fruits", slug: "snacks-aux-fruits", description: "Snacks aux fruits croquants et lyophilises." },
    },
  },
  {
    slug: "muesli-granola", parentSlug: "muesli-granen", sortOrder: 1,
    translations: {
      nl: { name: "Muesli & granola", slug: "muesli-granola", description: "Muesli, granola en ontbijtmixen." },
      en: { name: "Muesli & granola", slug: "muesli-granola", description: "Muesli, granola and breakfast mixes." },
      fr: { name: "Muesli & granola", slug: "muesli-granola", description: "Muesli, granola et melanges petit-dejeuner." },
    },
  },
  {
    slug: "havermout-granen", parentSlug: "muesli-granen", sortOrder: 2,
    translations: {
      nl: { name: "Havermout & granen", slug: "havermout-granen", description: "Havermout, havervlokken en meergranenvlokken." },
      en: { name: "Oats & grains", slug: "oats-grains", description: "Oatmeal, oat flakes and multigrain flakes." },
      fr: { name: "Avoine & cereales", slug: "avoine-cereales", description: "Flocons d'avoine et melanges de cereales." },
    },
  },
  {
    slug: "pitten", parentSlug: null, sortOrder: 3,
    translations: {
      nl: { name: "Pitten", slug: "pitten", description: "Pompoen-, zonnebloem- en pijnboompitten." },
      en: { name: "Kernels", slug: "kernels", description: "Pumpkin, sunflower and pine kernels." },
      fr: { name: "Graines decortiquees", slug: "graines-decortiquees", description: "Graines de courge, tournesol et pignons." },
    },
  },
  {
    slug: "zaden", parentSlug: null, sortOrder: 4,
    translations: {
      nl: { name: "Zaden", slug: "zaden", description: "Lijnzaad, sesam, chia, hennep en maanzaad." },
      en: { name: "Seeds", slug: "seeds", description: "Flax, sesame, chia, hemp and poppy seeds." },
      fr: { name: "Graines", slug: "graines-entieres", description: "Lin, sesame, chia, chanvre et pavot." },
    },
  },
  {
    slug: "zadenmixen-granen", parentSlug: "zaden", sortOrder: 1,
    translations: {
      nl: { name: "Mixen & quinoa", slug: "mixen-quinoa", description: "Zadenmixen, salademix en quinoa." },
      en: { name: "Mixes & quinoa", slug: "mixes-quinoa", description: "Seed mixes, salad mix and quinoa." },
      fr: { name: "Melanges & quinoa", slug: "melanges-quinoa", description: "Melanges de graines, salade et quinoa." },
    },
  },
  {
    slug: "pittige-snacks", parentSlug: "snacks-zoutjes", sortOrder: 1,
    translations: {
      nl: { name: "Pittige snacks", slug: "pittige-snacks", description: "Kruidige en pittige borrelsnacks." },
      en: { name: "Spicy snacks", slug: "spicy-snacks", description: "Seasoned and spicy savoury snacks." },
      fr: { name: "Snacks epices", slug: "snacks-epices", description: "Snacks sales assaisonnes et epices." },
    },
  },
  {
    slug: "crackers-zoutjes", parentSlug: "snacks-zoutjes", sortOrder: 2,
    translations: {
      nl: { name: "Crackers & zoutjes", slug: "crackers-zoutjes", description: "Krokante crackers en rijstsnacks." },
      en: { name: "Crackers & savouries", slug: "crackers-savouries", description: "Crunchy crackers and rice snacks." },
      fr: { name: "Crackers & biscuits sales", slug: "crackers-biscuits-sales", description: "Crackers croquants et snacks de riz." },
    },
  },
  {
    slug: "groentesnacks", parentSlug: "snacks-zoutjes", sortOrder: 3,
    translations: {
      nl: { name: "Groentesnacks", slug: "groentesnacks", description: "Groentechips, edamame en tuinbonen." },
      en: { name: "Vegetable snacks", slug: "vegetable-snacks", description: "Vegetable crisps, edamame and broad beans." },
      fr: { name: "Snacks de legumes", slug: "snacks-de-legumes", description: "Chips de legumes, edamame et feves." },
    },
  },
  {
    slug: "honing", parentSlug: "honing-natuurvoeding", sortOrder: 1,
    translations: {
      nl: { name: "Honing", slug: "honing", description: "Vloeibare honing, cremehoning en raathoning." },
      en: { name: "Honey", slug: "honey", description: "Liquid honey, creamed honey and comb honey." },
      fr: { name: "Miel", slug: "miel", description: "Miel liquide, miel cremeux et miel en rayon." },
    },
  },
  {
    slug: "baknoten", parentSlug: "bakproducten", sortOrder: 2,
    translations: {
      nl: { name: "Noten om te bakken", slug: "noten-om-te-bakken", description: "Amandelschaafsel, amandelstiften en amandelspijs." },
      en: { name: "Baking nuts", slug: "baking-nuts", description: "Flaked almonds, almond sticks and almond paste." },
      fr: { name: "Noix pour patisserie", slug: "noix-pour-patisserie", description: "Amandes effilees, batonnets et pate d'amande." },
    },
  },
  {
    slug: "bakfruit", parentSlug: "bakproducten", sortOrder: 3,
    translations: {
      nl: { name: "Fruit om te bakken", slug: "fruit-om-te-bakken", description: "Gekonfijt fruit, rozijnen en citrus voor gebak." },
      en: { name: "Baking fruit", slug: "baking-fruit", description: "Candied fruit, raisins and citrus for baking." },
      fr: { name: "Fruits pour patisserie", slug: "fruits-pour-patisserie", description: "Fruits confits, raisins et agrumes pour patisserie." },
    },
  },
];

const existingParents = [
  ["pinda-s", "noten", 8], ["notenmixen", "noten", 10],
  ["notenpasta-s", "honing-natuurvoeding", 2], ["superfood", "honing-natuurvoeding", 3],
  ["meel-griesmeel", "bakproducten", 1], ["gedroogd-fruit", "zoet", 1],
  ["gekonfijt-fruit", "zoet", 2],
] as const;

const rootOrder = [
  "noten", "chocolade-zoet", "muesli-granen", "pitten", "zaden",
  "snacks-zoutjes", "bakproducten", "honing-natuurvoeding",
] as const;

const sweetChocolateSkus = new Set(["CHO-5001-250-P", "CHO-5002-250-P", "CHO-5003-300-P", "CHO-5009-500-P"]);
const fruitSnackSkus = new Set(["SNK-6001-250-P", "SNK-6020-VAR-P"]);
const sweetSnackSkus = new Set(["SNK-6004-250-P", "SNK-6008-250-P"]);
const spicySnackSkus = new Set(["SNK-6005-250-P", "SNK-6007-250-P", "SNK-6009-225-P", "SNK-6010-150-P", "SNK-6012-250-P", "SNK-6017-250-P", "SNK-6003-250-P"]);
const crackerSkus = new Set(["SNK-6011-200-P", "SNK-6013-200-P", "SNK-6014-200-P", "SNK-6015-180-P", "SNK-6016-200-P", "SNK-6018-200-P", "SNK-6019-80-P"]);
const muesliSkus = new Set(["MUE-11001-500-P", "MUE-11005-500-P", "MUE-11006-250-P"]);
const kernelSkus = new Set(["PIT-7003-100-P", "PIT-7004-250-P", "PIT-7009-250-P"]);
const seedMixSkus = new Set(["PIT-7005-500-P", "PIT-7006-250-P", "PIT-7008-250-P"]);
const bakingNutSkus = new Set(["BAK-9015-100-P", "BAK-9016-VAR-P", "BAK-9017-250-P"]);
const bakingMealSkus = new Set(["BAK-9001-VAR-P", "BAK-9002-250-P", "BAK-9006-VAR-P", "BAK-9009-VAR-P", "BAK-9014-200-P"]);

function assignmentsForSku(sku: string): string[] {
  const nutFamily = getNutFamilyForProductSku(sku);
  if (nutFamily) return [nutFamily];
  if (sku.startsWith("PAS-")) return ["notenpasta-s"];
  if (sku.startsWith("CHO-")) {
    if (sweetChocolateSkus.has(sku)) return ["snoep-nougat"];
    const placement = getChocolatePlacementForProductSku(sku);
    if (!placement) throw new Error(`Geen chocoladefamilie vastgelegd voor SKU ${sku}.`);
    return [placement];
  }
  if (sku.startsWith("FRU-")) return ["gedroogd-fruit", ...(sku === "FRU-4033-VAR-P" || sku === "FRU-4034-VAR-P" ? ["bakfruit", "gekonfijt-fruit"] : [])];
  if (sku.startsWith("MUE-")) return [muesliSkus.has(sku) ? "muesli-granola" : "havermout-granen"];
  if (sku.startsWith("NAT-")) return ["honing"];
  if (sku.startsWith("PIT-")) return [kernelSkus.has(sku) ? "pitten" : seedMixSkus.has(sku) ? "zadenmixen-granen" : "zaden"];
  if (sku.startsWith("SUP-")) return ["superfood"];
  if (sku.startsWith("BAK-")) {
    if (bakingMealSkus.has(sku)) return ["meel-griesmeel"];
    if (bakingNutSkus.has(sku)) return ["baknoten"];
    return ["bakfruit", "gekonfijt-fruit"];
  }
  if (sku.startsWith("SNK-")) {
    if (fruitSnackSkus.has(sku)) return ["fruitsnacks"];
    if (sweetSnackSkus.has(sku)) return ["snoep-nougat"];
    if (crackerSkus.has(sku)) return ["crackers-zoutjes"];
    if (spicySnackSkus.has(sku)) return ["pittige-snacks"];
    return ["groentesnacks"];
  }
  throw new Error(`Geen taxonomie vastgelegd voor SKU ${sku}.`);
}

async function buildPlan() {
  const translationTargets = definitions.flatMap((definition) =>
    (["nl", "en", "fr"] as const).map((locale) => ({
      canonicalSlug: definition.slug,
      locale,
      slug: definition.translations[locale].slug,
    }))
  );
  const [categories, products, translationConflicts] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, parentId: true } }),
    prisma.product.findMany({ select: { id: true, sku: true, isActive: true } }),
    prisma.categoryTranslation.findMany({
      where: {
        OR: translationTargets.map(({ locale, slug }) => ({ locale, slug })),
      },
      select: { locale: true, slug: true, category: { select: { slug: true } } },
    }),
  ]);
  const knownSlugs = new Set([...categories.map((category) => category.slug), ...definitions.map((definition) => definition.slug)]);
  for (const definition of definitions) {
    if (definition.parentSlug && !knownSlugs.has(definition.parentSlug)) {
      throw new Error(`Bovenliggende categorie ontbreekt: ${definition.parentSlug}.`);
    }
  }
  for (const conflict of translationConflicts) {
    const target = translationTargets.find(
      (item) => item.locale === conflict.locale && item.slug === conflict.slug
    );
    if (target && target.canonicalSlug !== conflict.category.slug) {
      throw new Error(
        `Vertaalde slugconflict: ${conflict.locale}/${conflict.slug} hoort al bij ${conflict.category.slug}.`
      );
    }
  }
  const assignments = products.map((product) => ({ ...product, leafSlugs: assignmentsForSku(product.sku) }));
  const uncovered = assignments.filter((assignment) => assignment.leafSlugs.length === 0);
  if (uncovered.length > 0) throw new Error(`Ongedekte SKU's: ${uncovered.map((item) => item.sku).join(", ")}`);
  return { categories, products, assignments };
}

async function applyPlan(plan: Awaited<ReturnType<typeof buildPlan>>) {
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map(plan.categories.map((category) => [category.slug, category.id]));
    for (const definition of definitions) {
      const parentId = definition.parentSlug
        ? categoryIds.get(definition.parentSlug) ?? null
        : null;
      if (definition.parentSlug && !parentId) {
        throw new Error(`Bovenliggende categorie ontbreekt: ${definition.parentSlug}.`);
      }
      const category = await tx.category.upsert({
        where: { slug: definition.slug },
        create: { slug: definition.slug, parentId, sortOrder: definition.sortOrder, isActive: true },
        update: { parentId, sortOrder: definition.sortOrder, isActive: true },
      });
      categoryIds.set(definition.slug, category.id);
      for (const locale of ["nl", "en", "fr"] as const) {
        const translation = definition.translations[locale];
        await tx.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: category.id, locale } },
          create: { categoryId: category.id, locale, ...translation },
          update: translation,
        });
      }
    }

    for (const [slug, parentSlug, sortOrder] of existingParents) {
      const id = categoryIds.get(slug);
      const parentId = categoryIds.get(parentSlug);
      if (!id || !parentId) throw new Error(`Categorie-relatie ontbreekt: ${slug} -> ${parentSlug}.`);
      await tx.category.update({ where: { id }, data: { parentId, sortOrder, isActive: true } });
    }
    for (const [sortOrder, slug] of rootOrder.entries()) {
      const id = categoryIds.get(slug);
      if (!id) throw new Error(`Hoofdcategorie ontbreekt: ${slug}.`);
      await tx.category.update({ where: { id }, data: { parentId: null, sortOrder, isActive: true } });
    }
    const combinedSeedsId = categoryIds.get("pitten-zaden");
    if (combinedSeedsId) {
      await tx.productCategory.deleteMany({ where: { categoryId: combinedSeedsId } });
      await tx.category.update({
        where: { id: combinedSeedsId },
        data: { parentId: null, sortOrder: 99, isActive: false },
      });
    }
    const bakingId = categoryIds.get("bakproducten");
    if (bakingId) {
      for (const [locale, name] of [
        ["nl", "Bakken & koken"],
        ["en", "Baking & cooking"],
        ["fr", "Pâtisserie & cuisine"],
      ] as const) {
        await tx.categoryTranslation.updateMany({
          where: { categoryId: bakingId, locale },
          data: { name },
        });
      }
    }

    const hierarchy = await tx.category.findMany({
      select: { id: true, parentId: true },
    });
    for (const assignment of plan.assignments) {
      const leafCategoryIds = assignment.leafSlugs.map((slug) => {
        const categoryId = categoryIds.get(slug);
        if (!categoryId) throw new Error(`Bladcategorie ontbreekt: ${slug}.`);
        return categoryId;
      });
      const desiredCategoryIds = collectCategoryAndAncestorIds(
        leafCategoryIds,
        hierarchy
      );

      for (const [sortOrder, categoryId] of desiredCategoryIds.entries()) {
        await tx.productCategory.upsert({
          where: { productId_categoryId: { productId: assignment.id, categoryId } },
          create: { productId: assignment.id, categoryId, sortOrder, isPrimary: false },
          update: { sortOrder },
        });
      }
    }

    const snacksRootId = categoryIds.get("snacks-zoutjes");
    if (snacksRootId) {
      const movedSweetSkus = [...fruitSnackSkus, ...sweetSnackSkus];
      for (const assignment of plan.assignments.filter((item) => movedSweetSkus.includes(item.sku))) {
        const primaryLeafId = categoryIds.get(assignment.leafSlugs[0]);
        if (!primaryLeafId) throw new Error(`Primaire bladcategorie ontbreekt voor ${assignment.sku}.`);
        await tx.productCategory.deleteMany({
          where: { productId: assignment.id, categoryId: snacksRootId },
        });
        await tx.productCategory.update({
          where: { productId_categoryId: { productId: assignment.id, categoryId: primaryLeafId } },
          data: { isPrimary: true },
        });
      }
    }

    const gedroogdFruitId = categoryIds.get("gedroogd-fruit");
    if (gedroogdFruitId) {
      const misplacedSkus = [...bakingMealSkus, ...bakingNutSkus];
      await tx.productCategory.deleteMany({
        where: { categoryId: gedroogdFruitId, product: { sku: { in: misplacedSkus } } },
      });
    }

    const looseNutsId = categoryIds.get("losse-noten");
    if (looseNutsId) {
      await tx.productCategory.deleteMany({
        where: {
          categoryId: looseNutsId,
          product: { sku: { startsWith: "NOT-" } },
        },
      });
    }

    for (const assignment of plan.assignments) {
      const primaryLeafId = categoryIds.get(assignment.leafSlugs[0]);
      if (!primaryLeafId) throw new Error(`Primaire bladcategorie ontbreekt voor ${assignment.sku}.`);
      await tx.productCategory.updateMany({
        where: { productId: assignment.id },
        data: { isPrimary: false },
      });
      await tx.productCategory.update({
        where: { productId_categoryId: { productId: assignment.id, categoryId: primaryLeafId } },
        data: { isPrimary: true },
      });
    }
  }, { maxWait: 10_000, timeout: 120_000 });
}

async function main() {
  const plan = await buildPlan();
  const activeAssignments = plan.assignments.filter((item) => item.isActive);
  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    categoriesCreatedOrUpdated: definitions.length,
    productsCovered: plan.assignments.length,
    activeProductsCovered: activeAssignments.length,
    leafLinksPlanned: plan.assignments.reduce((sum, item) => sum + item.leafSlugs.length, 0),
    rootOrder,
  }, null, 2));
  if (!applyChanges) {
    console.log("Dry-run voltooid. Gebruik --apply om de taxonomie transactioneel toe te passen.");
    return;
  }
  await applyPlan(plan);
  console.log("Menutaxonomie en productkoppelingen transactioneel bijgewerkt.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
