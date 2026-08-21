import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { sanitizeProductHtml, sanitizeProductShortHtml } from "../lib/product-content";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length);
const reportArgument = process.argv.find((value) => value.startsWith("--report="))?.slice("--report=".length);
const requiredConfirmation = "RESTORE-PRESERVED-PRODUCT-HTML";

const names = [
  "Acaciahoning",
  "Afrikaanse Honing",
  "Amandel Nougat",
  "Amandelen gerookt",
  "Amandelen Wit Gezouten",
  "Ananas Ongezoet",
  "Amandelen Bruin Ongebrand",
  "Amandelen Wit Ongebrand",
  "Amandelen Wit Ongezouten",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  if (applyChanges && confirmation !== requiredConfirmation) {
    throw new Error(`Apply geblokkeerd. Voeg --confirm=${requiredConfirmation} toe.`);
  }

  const rows = await prisma.productTranslation.findMany({
    where: { locale: "nl", name: { in: names } },
    select: {
      id: true,
      productId: true,
      name: true,
      shortDescription: true,
      shortDescriptionHtml: true,
      description: true,
      descriptionHtml: true,
    },
  });
  const rowByName = new Map(rows.map((row) => [row.name, row]));
  const missing = names.filter((name) => !rowByName.has(name));
  const protectedConflicts = rows.filter((row) => row.shortDescriptionHtml?.trim() || row.descriptionHtml?.trim());
  const ready = rows.filter((row) =>
    !row.shortDescriptionHtml?.trim()
    && !row.descriptionHtml?.trim()
    && row.shortDescription?.trim()
    && row.description?.trim(),
  ).map((row) => ({
    row,
    shortDescriptionHtml: sanitizeProductShortHtml(`<p>${escapeHtml(row.shortDescription!)}</p>`),
    descriptionHtml: sanitizeProductHtml(`<p>${escapeHtml(row.description!)}</p>`),
  }));
  const incomplete = rows.filter((row) => !row.shortDescription?.trim() || !row.description?.trim());
  const report = {
    mode: applyChanges ? "apply-requested" : "dry-run",
    generatedAt: new Date().toISOString(),
    sourceNames: names.length,
    ready: ready.map((item) => item.row.name),
    alreadyOrProtected: protectedConflicts.map((row) => row.name),
    missing,
    incomplete: incomplete.map((row) => row.name),
  };
  if (reportArgument) await writeFile(resolve(process.cwd(), reportArgument), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!applyChanges) return;
  if (missing.length || incomplete.length) throw new Error("Apply geblokkeerd door ontbrekende of incomplete brontekst.");

  await prisma.$transaction(async (transaction) => {
    for (const item of ready) {
      const result = await transaction.productTranslation.updateMany({
        where: {
          id: item.row.id,
          productId: item.row.productId,
          shortDescription: item.row.shortDescription,
          shortDescriptionHtml: item.row.shortDescriptionHtml,
          description: item.row.description,
          descriptionHtml: item.row.descriptionHtml,
        },
        data: {
          shortDescriptionHtml: item.shortDescriptionHtml,
          descriptionHtml: item.descriptionHtml,
        },
      });
      if (result.count !== 1) throw new Error(`Gelijktijdige wijziging gedetecteerd voor ${item.row.name}.`);
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 30_000,
  });

  console.log(JSON.stringify({ mode: "applied", restored: ready.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
