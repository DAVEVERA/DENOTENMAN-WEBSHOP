import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const legacyPatterns = [
  "van De Notenman valt binnen",
  "Op de productpagina staan de beschikbare gewichten",
  "puur genieten met karakter",
  "Zin in iets dat meteen goed smaakt",
  "Een product dat uitnodigt om te proeven",
  "Bestel eenvoudig bij De Notenman",
];

async function main() {
  const rows = await prisma.productTranslation.findMany({
    where: { locale: "nl", product: { isActive: true } },
    select: {
      name: true,
      shortDescription: true,
      shortDescriptionHtml: true,
      description: true,
      descriptionHtml: true,
    },
  });
  const remainingLegacy = rows.flatMap((row) => {
    const reasons = [
      ...(!row.shortDescription?.trim() ? ["missing-short"] : []),
      ...(!row.description?.trim() ? ["missing-full"] : []),
      ...legacyPatterns
        .filter((pattern) => row.shortDescription?.includes(pattern) || row.description?.includes(pattern))
        .map((pattern) => `pattern:${pattern}`),
    ];
    return reasons.length ? [{ name: row.name, reasons }] : [];
  });

  console.log(JSON.stringify({
    activeNlProducts: rows.length,
    richShortDescriptions: rows.filter((row) => row.shortDescriptionHtml?.trim()).length,
    richFullDescriptions: rows.filter((row) => row.descriptionHtml?.trim()).length,
    remainingLegacyCount: remainingLegacy.length,
    remainingLegacy: remainingLegacy.sort((a, b) => a.name.localeCompare(b.name, "nl")),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
