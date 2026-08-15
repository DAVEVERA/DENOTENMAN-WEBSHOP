import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Refusing to seed: this fixture is restricted to the temporary localhost database.");
}

const prisma = new PrismaClient();
const categoryId = "cmtestcategory000000000001";

async function main() {
await prisma.category.create({
  data: {
    id: categoryId,
    slug: "test-noten",
    translations: { create: { locale: "nl", name: "Testnoten", slug: "test-noten", description: "Testcategorie" } },
  },
});

const products = await Promise.all(
  ["Amandelen", "Cashewnoten", "Pecannoten", "Pistachenoten"].map((name, index) => {
    const slug = `test-${name.toLowerCase()}`;
    const productId = `cmtestproduct0000000000${index + 1}`;
    return prisma.product.create({
      data: {
        id: productId,
        slug,
        sku: `TEST-${index + 1}`,
        basePriceCents: 695 + index * 100,
        isActive: index !== 3,
        translations: { create: { locale: "nl", name, slug, shortDescription: `${name} met een herkenbare smaak en stevige bite.`, description: `${name} als lokale testfixture voor de productbeheer- en storefrontflow.` } },
        productCategories: { create: { categoryId } },
        variants: { create: { sku: `TEST-${index + 1}-250`, priceCents: 695 + index * 100, stock: 10, weightGrams: 250, preparation: "ROASTED", salting: "UNSALTED", translations: { create: { locale: "nl", label: "250 gram" } } } },
      },
    });
  })
);

await prisma.productRecommendation.createMany({
  data: products.slice(1).map((target, sortOrder) => ({ sourceProductId: products[0].id, targetProductId: target.id, sortOrder })),
});

await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
