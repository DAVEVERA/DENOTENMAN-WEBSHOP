/**
 * fill-missing-images.js
 * Koppelt een placeholder aan producten die nog steeds geen afbeelding hebben.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const noImg = await prisma.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, name: true },
  });

  console.log(`${noImg.length} producten zonder afbeelding → placeholder toekennen`);

  for (const p of noImg) {
    await prisma.productImage.create({
      data: {
        productId: p.id,
        url: "/products/placeholder.png",
        altText: p.name,
        position: 0,
      },
    });
    console.log(`  ✓ ${p.name}`);
  }

  console.log(`\n✅ Klaar — ${noImg.length} placeholders toegekend`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
