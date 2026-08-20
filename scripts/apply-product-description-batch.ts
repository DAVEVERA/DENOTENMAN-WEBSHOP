import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  toProductPlainText,
} from "../lib/product-content";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");
const batchArgument = process.argv.find((argument) => !argument.startsWith("--") && argument.endsWith(".json"));

type BatchEntry = {
  productId: string;
  currentNlName: string;
  shortDescriptionHtml: string;
  descriptionHtml: string;
};

function assertBatch(value: unknown): asserts value is BatchEntry[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new Error("Een producttekstbatch moet 1 tot en met 10 items bevatten.");
  }

  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== "object") throw new Error(`Item ${index + 1} is ongeldig.`);
    const candidate = entry as Partial<BatchEntry>;
    for (const field of ["productId", "currentNlName", "shortDescriptionHtml", "descriptionHtml"] as const) {
      if (typeof candidate[field] !== "string" || !candidate[field]?.trim()) {
        throw new Error(`Item ${index + 1} mist ${field}.`);
      }
    }
    if (ids.has(candidate.productId!)) throw new Error(`Dubbel productId: ${candidate.productId}`);
    ids.add(candidate.productId!);
  }
}

async function main() {
  if (!batchArgument) {
    throw new Error("Gebruik: npx tsx scripts/apply-product-description-batch.ts <batch.json> [--apply]");
  }

  const batchPath = resolve(process.cwd(), batchArgument);
  const batch: unknown = JSON.parse(await readFile(batchPath, "utf8"));
  assertBatch(batch);

  const prepared = batch.map((entry) => {
    const shortDescriptionHtml = sanitizeProductShortHtml(entry.shortDescriptionHtml);
    const descriptionHtml = sanitizeProductHtml(entry.descriptionHtml);
    if (shortDescriptionHtml !== entry.shortDescriptionHtml || descriptionHtml !== entry.descriptionHtml) {
      throw new Error(`Niet-canonieke of onveilige HTML voor ${entry.currentNlName}.`);
    }
    const shortDescription = toProductPlainText(shortDescriptionHtml);
    const description = toProductPlainText(descriptionHtml);
    if (shortDescription.length > 220) {
      throw new Error(`Korte omschrijving van ${entry.currentNlName} bevat ${shortDescription.length}/220 tekens.`);
    }
    return { ...entry, shortDescription, description };
  });

  const current = await prisma.productTranslation.findMany({
    where: { locale: "nl", productId: { in: prepared.map((entry) => entry.productId) } },
    select: {
      id: true,
      productId: true,
      name: true,
      slug: true,
      description: true,
      descriptionHtml: true,
      shortDescription: true,
      shortDescriptionHtml: true,
      product: { select: { isActive: true } },
    },
  });
  if (current.length !== prepared.length) {
    throw new Error(`Verwachtte ${prepared.length} Nederlandse vertalingen, vond ${current.length}.`);
  }

  const currentByProductId = new Map(current.map((translation) => [translation.productId, translation]));
  for (const entry of prepared) {
    const translation = currentByProductId.get(entry.productId);
    if (!translation) throw new Error(`Nederlandse vertaling ontbreekt: ${entry.productId}`);
    if (!translation.product.isActive) throw new Error(`Product is niet actief: ${entry.currentNlName}`);
    if (translation.name !== entry.currentNlName) {
      throw new Error(`Naamconflict voor ${entry.productId}: verwacht '${entry.currentNlName}', vond '${translation.name}'.`);
    }
  }

  if (!applyChanges) {
    console.log(JSON.stringify({ mode: "dry-run", batchPath, count: prepared.length, products: prepared.map(({ productId, currentNlName, shortDescription }) => ({ productId, name: currentNlName, slug: currentByProductId.get(productId)?.slug, shortLength: shortDescription.length })) }, null, 2));
    return;
  }

  await prisma.$transaction(async (transaction) => {
    for (const entry of prepared) {
      const previous = currentByProductId.get(entry.productId)!;
      const result = await transaction.productTranslation.updateMany({
        where: {
          id: previous.id,
          name: entry.currentNlName,
          description: previous.description,
          descriptionHtml: previous.descriptionHtml,
          shortDescription: previous.shortDescription,
          shortDescriptionHtml: previous.shortDescriptionHtml,
        },
        data: {
          shortDescription: entry.shortDescription,
          shortDescriptionHtml: entry.shortDescriptionHtml,
          description: entry.description,
          descriptionHtml: entry.descriptionHtml,
        },
      });
      if (result.count !== 1) throw new Error(`Gelijktijdige wijziging gedetecteerd voor ${entry.currentNlName}; batch teruggedraaid.`);
      await transaction.product.update({
        where: { id: entry.productId },
        data: { updatedAt: new Date() },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const verified = await prisma.productTranslation.findMany({
    where: { locale: "nl", productId: { in: prepared.map((entry) => entry.productId) } },
    select: { productId: true, name: true, description: true, descriptionHtml: true, shortDescription: true, shortDescriptionHtml: true },
  });
  const verifiedByProductId = new Map(verified.map((translation) => [translation.productId, translation]));
  for (const entry of prepared) {
    const actual = verifiedByProductId.get(entry.productId);
    if (!actual || actual.name !== entry.currentNlName || actual.shortDescription !== entry.shortDescription || actual.shortDescriptionHtml !== entry.shortDescriptionHtml || actual.description !== entry.description || actual.descriptionHtml !== entry.descriptionHtml) {
      throw new Error(`Nacontrole mislukt voor ${entry.currentNlName}.`);
    }
  }

  console.log(JSON.stringify({ mode: "applied", count: verified.length, products: prepared.map(({ productId, currentNlName }) => ({ productId, name: currentNlName })) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
