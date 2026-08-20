import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  toProductPlainText,
} from "../lib/product-content";

const prisma = new PrismaClient();

type BatchEntry = {
  productId: string;
  currentNlName: string;
  shortDescriptionHtml: string;
  descriptionHtml: string;
};

async function main() {
  const batchDirectory = resolve(process.cwd(), "content/product-descriptions");
  const files = (await readdir(batchDirectory))
    .filter((file) => /^nl-batch-\d+\.json$/.test(file))
    .sort();
  const entries: BatchEntry[] = [];
  for (const file of files) {
    entries.push(...JSON.parse(await readFile(resolve(batchDirectory, file), "utf8")) as BatchEntry[]);
  }
  const duplicateIds = entries
    .map((entry) => entry.productId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) throw new Error(`Dubbele product-ID's: ${[...new Set(duplicateIds)].join(", ")}`);

  const rows = await prisma.productTranslation.findMany({
    where: { locale: "nl", productId: { in: entries.map((entry) => entry.productId) } },
    select: { productId: true, name: true, shortDescription: true, shortDescriptionHtml: true, description: true, descriptionHtml: true },
  });
  const rowsByProductId = new Map(rows.map((row) => [row.productId, row]));
  const mismatches = entries.flatMap((entry) => {
    const actual = rowsByProductId.get(entry.productId);
    if (!actual) return [{ productId: entry.productId, name: entry.currentNlName, fields: ["missing"] }];
    const expectedShortHtml = sanitizeProductShortHtml(entry.shortDescriptionHtml);
    const expectedFullHtml = sanitizeProductHtml(entry.descriptionHtml);
    const expected = {
      name: entry.currentNlName,
      shortDescription: toProductPlainText(expectedShortHtml),
      shortDescriptionHtml: expectedShortHtml,
      description: toProductPlainText(expectedFullHtml),
      descriptionHtml: expectedFullHtml,
    };
    const fields = (Object.keys(expected) as Array<keyof typeof expected>)
      .filter((field) => actual[field] !== expected[field]);
    return fields.length ? [{ productId: entry.productId, name: entry.currentNlName, fields }] : [];
  });

  console.log(JSON.stringify({
    batchFiles: files.length,
    expectedRecords: entries.length,
    foundRecords: rows.length,
    matchingRecords: entries.length - mismatches.length,
    mismatchCount: mismatches.length,
    mismatches,
  }, null, 2));
  if (mismatches.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
