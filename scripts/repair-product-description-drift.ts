import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  toProductPlainText,
} from "../lib/product-content";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");
const legacyPatterns = [
  "van De Notenman valt binnen",
  "Op de productpagina staan de beschikbare gewichten",
  "puur genieten met karakter",
  "Zin in iets dat meteen goed smaakt",
  "Een product dat uitnodigt om te proeven",
  "Bestel eenvoudig bij De Notenman",
];

type BatchEntry = {
  productId: string;
  currentNlName: string;
  shortDescriptionHtml: string;
  descriptionHtml: string;
};

async function readEntries(): Promise<BatchEntry[]> {
  const directory = resolve(process.cwd(), "content/product-descriptions");
  const files = (await readdir(directory)).filter((file) => /^nl-batch-\d+\.json$/.test(file)).sort();
  const entries: BatchEntry[] = [];
  for (const file of files) entries.push(...JSON.parse(await readFile(resolve(directory, file), "utf8")) as BatchEntry[]);
  if (new Set(entries.map((entry) => entry.productId)).size !== entries.length) throw new Error("Dubbele product-ID's in batches.");
  return entries;
}

function isLegacy(row: { shortDescription: string | null; description: string | null }): boolean {
  return needsRepair(row.shortDescription) || needsRepair(row.description);
}

function needsRepair(value: string | null): boolean {
  return !value?.trim() || legacyPatterns.some((pattern) => value.includes(pattern));
}

async function main() {
  const entries = await readEntries();
  const entryById = new Map(entries.map((entry) => [entry.productId, entry]));
  const current = await prisma.productTranslation.findMany({
    where: { locale: "nl", productId: { in: entries.map((entry) => entry.productId) } },
    select: { id: true, productId: true, name: true, shortDescription: true, shortDescriptionHtml: true, description: true, descriptionHtml: true },
  });
  const legacy = current.filter(isLegacy);

  if (!applyChanges) {
    console.log(JSON.stringify({ mode: "dry-run", protectedProducts: entries.length, repairCount: legacy.length, repairs: legacy.map((row) => ({ productId: row.productId, name: row.name })) }, null, 2));
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const lockedCurrent = await transaction.productTranslation.findMany({
      where: { locale: "nl", productId: { in: entries.map((entry) => entry.productId) } },
      select: { id: true, productId: true, name: true, shortDescription: true, shortDescriptionHtml: true, description: true, descriptionHtml: true },
    });
    const timestamp = new Date();
    await transaction.product.updateMany({
      where: { id: { in: entries.map((entry) => entry.productId) } },
      data: { updatedAt: timestamp },
    });

    for (const previous of lockedCurrent.filter(isLegacy)) {
      const entry = entryById.get(previous.productId);
      if (!entry || previous.name !== entry.currentNlName) throw new Error(`Batchcontract ontbreekt of naam wijkt af: ${previous.productId}`);
      const shortDescriptionHtml = sanitizeProductShortHtml(entry.shortDescriptionHtml);
      const descriptionHtml = sanitizeProductHtml(entry.descriptionHtml);
      const repairShort = needsRepair(previous.shortDescription);
      const repairFull = needsRepair(previous.description);
      const result = await transaction.productTranslation.updateMany({
        where: {
          id: previous.id,
          shortDescription: previous.shortDescription,
          shortDescriptionHtml: previous.shortDescriptionHtml,
          description: previous.description,
          descriptionHtml: previous.descriptionHtml,
        },
        data: {
          ...(repairShort ? {
            shortDescription: toProductPlainText(shortDescriptionHtml),
            shortDescriptionHtml,
          } : {}),
          ...(repairFull ? {
            description: toProductPlainText(descriptionHtml),
            descriptionHtml,
          } : {}),
        },
      });
      if (result.count !== 1) throw new Error(`Gelijktijdige wijziging gedetecteerd: ${previous.name}`);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const remaining = await prisma.productTranslation.findMany({
    where: { locale: "nl", productId: { in: entries.map((entry) => entry.productId) } },
    select: { name: true, shortDescription: true, description: true },
  });
  const remainingLegacy = remaining.filter(isLegacy).map((row) => row.name);
  console.log(JSON.stringify({ mode: "applied", protectedProducts: entries.length, repaired: legacy.length, remainingLegacy }, null, 2));
  if (remainingLegacy.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
