import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  sanitizeProductHtml,
  sanitizeProductShortHtml,
  toProductPlainText,
} from "../lib/product-content";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");
const confirmation = process.argv.find((argument) => argument.startsWith("--confirm="))?.slice("--confirm=".length);
const reportArgument = process.argv.find((argument) => argument.startsWith("--report="))?.slice("--report=".length);
const requiredConfirmation = "RESTORE-PRODUCT-DESCRIPTIONS";

type BatchEntry = {
  productId: string;
  currentNlName: string;
  shortDescriptionHtml: string;
  descriptionHtml: string;
};

type PreparedEntry = BatchEntry & {
  shortDescription: string;
  description: string;
  sourceHash: string;
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function readEntries(): Promise<PreparedEntry[]> {
  const directory = resolve(process.cwd(), "content/product-descriptions");
  const files = (await readdir(directory)).filter((file) => /^nl-batch-\d+\.json$/.test(file)).sort();
  const raw: BatchEntry[] = [];
  for (const file of files) raw.push(...JSON.parse(await readFile(resolve(directory, file), "utf8")) as BatchEntry[]);

  const duplicateNames = raw
    .map((entry) => entry.currentNlName)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length) throw new Error(`Dubbele Nederlandse productnamen in bron: ${[...new Set(duplicateNames)].join(", ")}`);

  return raw.map((entry) => {
    const shortDescriptionHtml = sanitizeProductShortHtml(entry.shortDescriptionHtml);
    const descriptionHtml = sanitizeProductHtml(entry.descriptionHtml);
    if (shortDescriptionHtml !== entry.shortDescriptionHtml || descriptionHtml !== entry.descriptionHtml) {
      throw new Error(`Niet-canonieke of onveilige bron-HTML voor ${entry.currentNlName}.`);
    }
    const shortDescription = toProductPlainText(shortDescriptionHtml);
    const description = toProductPlainText(descriptionHtml);
    if (shortDescription.length > 220) {
      throw new Error(`Korte omschrijving van ${entry.currentNlName} bevat ${shortDescription.length}/220 tekens.`);
    }
    return {
      ...entry,
      shortDescription,
      description,
      sourceHash: hash(`${shortDescriptionHtml}\n${descriptionHtml}`),
    };
  });
}

async function main() {
  if (applyChanges && confirmation !== requiredConfirmation) {
    throw new Error(`Apply geblokkeerd. Voeg --confirm=${requiredConfirmation} toe na goedgekeurde dry-run.`);
  }

  const entries = await readEntries();
  const current = await prisma.productTranslation.findMany({
    where: { locale: "nl" },
    select: {
      id: true,
      productId: true,
      name: true,
      shortDescription: true,
      shortDescriptionHtml: true,
      description: true,
      descriptionHtml: true,
      product: { select: { sku: true, slug: true, isActive: true } },
    },
  });
  const rowsByName = new Map<string, typeof current>();
  for (const row of current) rowsByName.set(row.name, [...(rowsByName.get(row.name) ?? []), row]);

  const matches = entries.map((entry) => {
    const candidates = rowsByName.get(entry.currentNlName) ?? [];
    if (candidates.length === 0) return { status: "missing" as const, entry, candidates };
    if (candidates.length > 1) return { status: "ambiguous" as const, entry, candidates };
    const row = candidates[0];
    const targetHash = hash(`${entry.shortDescriptionHtml}\n${entry.descriptionHtml}`);
    const currentHash = hash(`${row.shortDescriptionHtml ?? ""}\n${row.descriptionHtml ?? ""}`);
    if (
      row.shortDescription === entry.shortDescription
      && row.shortDescriptionHtml === entry.shortDescriptionHtml
      && row.description === entry.description
      && row.descriptionHtml === entry.descriptionHtml
    ) {
      return { status: "already-restored" as const, entry, row, targetHash, currentHash };
    }
    if (row.shortDescriptionHtml?.trim() || row.descriptionHtml?.trim()) {
      return { status: "protected-conflict" as const, entry, row, targetHash, currentHash };
    }
    return { status: "ready" as const, entry, row, targetHash, currentHash };
  });

  const ready = matches.filter((match): match is Extract<typeof match, { status: "ready" }> => match.status === "ready");
  const blockers = matches.filter((match) => match.status === "ambiguous" || match.status === "protected-conflict");
  const missing = matches.filter((match) => match.status === "missing");

  const report = {
    mode: applyChanges ? "apply-requested" : "dry-run",
    generatedAt: new Date().toISOString(),
    sourceEntries: entries.length,
    currentNlProducts: current.length,
    ready: ready.length,
    alreadyRestored: matches.filter((match) => match.status === "already-restored").length,
    missing: missing.length,
    ambiguous: matches.filter((match) => match.status === "ambiguous").length,
    protectedConflicts: matches.filter((match) => match.status === "protected-conflict").length,
    blockers: blockers.map((match) => ({
      status: match.status,
      name: match.entry.currentNlName,
      sourceProductId: match.entry.productId,
      candidates: match.status === "ambiguous"
        ? match.candidates.map((candidate) => ({ productId: candidate.productId, sku: candidate.product.sku, slug: candidate.product.slug }))
        : [{ productId: match.row.productId, sku: match.row.product.sku, slug: match.row.product.slug }],
    })),
    missingProducts: missing.map((match) => ({ name: match.entry.currentNlName, sourceProductId: match.entry.productId })),
    changes: ready.map((match) => ({
      name: match.entry.currentNlName,
      sourceProductId: match.entry.productId,
      targetProductId: match.row.productId,
      sku: match.row.product.sku,
      slug: match.row.product.slug,
      isActive: match.row.product.isActive,
      beforeHash: match.currentHash,
      afterHash: match.targetHash,
    })),
  };

  if (reportArgument) await writeFile(resolve(process.cwd(), reportArgument), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!applyChanges) return;
  if (blockers.length) throw new Error(`Apply geblokkeerd door ${blockers.length} ambigu/conflicterende records.`);

  await prisma.$transaction(async (transaction) => {
    for (const match of ready) {
      const result = await transaction.productTranslation.updateMany({
        where: {
          id: match.row.id,
          productId: match.row.productId,
          name: match.entry.currentNlName,
          shortDescription: match.row.shortDescription,
          shortDescriptionHtml: match.row.shortDescriptionHtml,
          description: match.row.description,
          descriptionHtml: match.row.descriptionHtml,
        },
        data: {
          shortDescription: match.entry.shortDescription,
          shortDescriptionHtml: match.entry.shortDescriptionHtml,
          description: match.entry.description,
          descriptionHtml: match.entry.descriptionHtml,
        },
      });
      if (result.count !== 1) throw new Error(`Gelijktijdige wijziging gedetecteerd voor ${match.entry.currentNlName}; transactie teruggedraaid.`);
      await transaction.product.update({ where: { id: match.row.productId }, data: { updatedAt: new Date() } });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  });

  console.log(JSON.stringify({ mode: "applied", restored: ready.length, skippedMissing: missing.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
