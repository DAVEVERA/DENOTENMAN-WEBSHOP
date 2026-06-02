import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany();
  console.log("Categories:", cats.map(c => c.slug));
  const products = await prisma.product.findMany();
  console.log("Total Products:", products.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
