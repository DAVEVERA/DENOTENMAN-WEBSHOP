import { Prisma, PrismaClient } from "@prisma/client";
import { sanitizeProductShortHtml, toProductPlainText } from "../lib/product-content";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function main() {
  const rows = await prisma.productTranslation.findMany({
    where: {
      locale: "nl",
      product: { isActive: true },
      shortDescriptionHtml: null,
      shortDescription: { not: null },
    },
    select: { id: true, productId: true, name: true, shortDescription: true },
  });
  const prepared = rows.map((row) => {
    const html = sanitizeProductShortHtml(`<p>${escapeHtml(row.shortDescription!)}</p>`);
    if (toProductPlainText(html) !== row.shortDescription!.replace(/\s+/g, " ").trim()) {
      throw new Error(`Plain-textbehoud mislukt voor ${row.name}.`);
    }
    return { ...row, html };
  });

  if (!applyChanges) {
    console.log(JSON.stringify({ mode: "dry-run", count: prepared.length, products: prepared.map(({ productId, name }) => ({ productId, name })) }, null, 2));
    return;
  }

  await prisma.$transaction(async (transaction) => {
    for (const row of prepared) {
      const result = await transaction.productTranslation.updateMany({
        where: { id: row.id, shortDescription: row.shortDescription, shortDescriptionHtml: null },
        data: { shortDescriptionHtml: row.html },
      });
      if (result.count !== 1) throw new Error(`Gelijktijdige wijziging gedetecteerd voor ${row.name}.`);
      await transaction.product.update({ where: { id: row.productId }, data: { updatedAt: new Date() } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log(JSON.stringify({ mode: "applied", count: prepared.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
