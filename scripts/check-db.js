/**
 * check-db.js - Controleer de huidige status van producten en afbeeldingen
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function run() {
  const prods = await p.product.count();
  const imgs = await p.productImage.count();
  const noImg = await p.product.count({ where: { images: { none: {} } } });
  const sample = await p.productImage.findFirst({ select: { url: true } });

  console.log(`Producten in DB    : ${prods}`);
  console.log(`Afbeeldingen in DB : ${imgs}`);
  console.log(`Zonder afbeelding  : ${noImg}`);
  if (sample) console.log(`Voorbeeld URL      : ${sample.url}`);

  await p.$disconnect();
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
