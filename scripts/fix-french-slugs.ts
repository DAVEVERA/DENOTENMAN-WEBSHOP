import { PrismaClient } from "@prisma/client";
import { planFrenchProductSlugs } from "../lib/french-slug-plan";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

const categorySlugCorrections = [
  { oldSlug: "cacahu-tes", nextSlug: "cacahuetes" },
  { oldSlug: "m-langes-de-noix", nextSlug: "melanges-de-noix" },
  { oldSlug: "muesli-c-r-ales", nextSlug: "muesli-cereales" },
  { oldSlug: "produits-de-p-tisserie", nextSlug: "produits-de-patisserie" },
] as const;

async function inspectPlan() {
  const [productTranslations, categoryTranslations] = await Promise.all([
    prisma.productTranslation.findMany({
      where: { locale: "fr" },
      select: { productId: true, name: true, slug: true },
    }),
    prisma.categoryTranslation.findMany({
      where: {
        locale: "fr",
        slug: { in: categorySlugCorrections.map(({ oldSlug }) => oldSlug) },
      },
      select: { categoryId: true, slug: true },
    }),
  ]);

  const products = planFrenchProductSlugs(productTranslations);
  const categories = categoryTranslations.flatMap((translation) => {
    const correction = categorySlugCorrections.find(
      ({ oldSlug }) => oldSlug === translation.slug
    );
    return correction
      ? [{ ...translation, oldSlug: correction.oldSlug, nextSlug: correction.nextSlug }]
      : [];
  });

  return { products, categories };
}

async function applyPlan(
  plan: Awaited<ReturnType<typeof inspectPlan>>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const changedAt = new Date();
    for (const product of plan.products) {
      const conflictingTargetAlias = await tx.productSlugAlias.findUnique({
        where: { locale_slug: { locale: "fr", slug: product.nextSlug } },
        select: { productId: true },
      });

      if (conflictingTargetAlias && conflictingTargetAlias.productId !== product.productId) {
        throw new Error(`Doelslugconflict voor /fr/produits/${product.nextSlug}.`);
      }

      const conflictingAlias = await tx.productSlugAlias.findUnique({
        where: { locale_slug: { locale: "fr", slug: product.slug } },
        select: { productId: true },
      });

      if (conflictingAlias && conflictingAlias.productId !== product.productId) {
        throw new Error(`Aliasconflict voor /fr/produits/${product.slug}.`);
      }

      await tx.productSlugAlias.upsert({
        where: { locale_slug: { locale: "fr", slug: product.slug } },
        create: { locale: "fr", slug: product.slug, productId: product.productId },
        update: { productId: product.productId },
      });
    }

    for (const [index, product] of plan.products.entries()) {
      await tx.productTranslation.update({
        where: {
          productId_locale: { productId: product.productId, locale: "fr" },
        },
        data: { slug: `seo-fr-${index}-${product.productId}` },
      });
    }

    for (const product of plan.products) {
      await tx.productTranslation.update({
        where: {
          productId_locale: { productId: product.productId, locale: "fr" },
        },
        data: { slug: product.nextSlug },
      });
      await tx.product.update({
        where: { id: product.productId },
        data: { updatedAt: changedAt },
      });
    }

    for (const category of plan.categories) {
      await tx.categoryTranslation.update({
        where: {
          categoryId_locale: { categoryId: category.categoryId, locale: "fr" },
        },
        data: { slug: category.nextSlug },
      });
      await tx.category.update({
        where: { id: category.categoryId },
        data: { updatedAt: changedAt },
      });
    }
  });
}

async function main(): Promise<void> {
  const plan = await inspectPlan();
  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? "apply" : "dry-run",
        products: plan.products.length,
        categories: plan.categories.length,
        productChanges: plan.products.map(({ productId, slug, nextSlug }) => ({
          productId,
          from: slug,
          to: nextSlug,
        })),
        categoryChanges: plan.categories.map(({ categoryId, oldSlug, nextSlug }) => ({
          categoryId,
          from: oldSlug,
          to: nextSlug,
        })),
      },
      null,
      2
    )
  );

  if (!applyChanges) {
    console.log("Dry-run voltooid. Gebruik --apply om deze transactie uit te voeren.");
    return;
  }

  await applyPlan(plan);
  console.log("Franse slugs en productaliases zijn transactioneel bijgewerkt.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
