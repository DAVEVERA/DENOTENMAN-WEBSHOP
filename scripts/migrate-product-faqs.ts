import { createHash } from "node:crypto";
import { recordAudit } from "../lib/admin-audit";
import { prisma } from "../lib/prisma";
import { sanitizeFaqHtml } from "../lib/product-faq-schema";

const apply = process.argv.includes("--apply");
const SAMPLE_LIMIT = 10;

function argumentValue(name: string): string | null {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

const migrationAdminId = argumentValue("--admin-id");

type LegacyEntry = { index: number; translations: Array<{ locale: "nl" | "en" | "fr"; question: string; answerHtml: string; mediaLabel: null }> };

function parseLegacy(attributes: Array<{ key: string; value: string }>): LegacyEntry[] {
  const values = new Map(attributes.map((attribute) => [attribute.key, attribute.value]));
  return [1, 2].flatMap((index) => {
    const translations = (["nl", "en", "fr"] as const).flatMap((locale) => {
      const question = values.get(`faq.${index}.question.${locale}`) ?? values.get(`faq.${index}.question`);
      const answer = values.get(`faq.${index}.answer.${locale}`) ?? values.get(`faq.${index}.answer`);
      if (!question?.trim() || !answer?.trim()) return [];
      return [{ locale, question: question.trim(), answerHtml: sanitizeFaqHtml(answer), mediaLabel: null }];
    });
    return translations.length ? [{ index, translations }] : [];
  });
}

function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(rows: unknown[]): { count: number; sha256: string } {
  return {
    count: rows.length,
    sha256: createHash("sha256").update(canonicalJson(rows)).digest("hex"),
  };
}

async function protectedFingerprints() {
  const [products, productTranslations, variants, variantTranslations, images, attributes, categories, recommendations, orders, orderItems] = await Promise.all([
    prisma.product.findMany({ orderBy: { id: "asc" } }),
    prisma.productTranslation.findMany({ orderBy: { id: "asc" } }),
    prisma.productVariant.findMany({ orderBy: { id: "asc" } }),
    prisma.variantTranslation.findMany({ orderBy: { id: "asc" } }),
    prisma.productImage.findMany({ orderBy: { id: "asc" } }),
    prisma.productAttribute.findMany({ orderBy: { id: "asc" } }),
    prisma.productCategory.findMany({ orderBy: [{ productId: "asc" }, { categoryId: "asc" }] }),
    prisma.productRecommendation.findMany({ orderBy: [{ sourceProductId: "asc" }, { targetProductId: "asc" }] }),
    prisma.order.findMany({ orderBy: { id: "asc" } }),
    prisma.orderItem.findMany({ orderBy: { id: "asc" } }),
  ]);
  return {
    products: fingerprint(products),
    productTranslations: fingerprint(productTranslations),
    variants: fingerprint(variants),
    variantTranslations: fingerprint(variantTranslations),
    images: fingerprint(images),
    attributes: fingerprint(attributes),
    productCategories: fingerprint(categories),
    recommendations: fingerprint(recommendations),
    orders: fingerprint(orders),
    orderItems: fingerprint(orderItems),
  };
}

async function main() {
  if (apply && !migrationAdminId) throw new Error("Gebruik --admin-id=<id> bij --apply voor expliciet revisie-auteurschap en auditprovenance.");
  const before = await protectedFingerprints();
  const [schemaState] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('"ProductFaqSet"') IS NOT NULL AS "exists"
  `;
  const schemaReady = schemaState?.exists === true;
  if (apply && !schemaReady) throw new Error("ProductFaqSet bestaat nog niet. Voer eerst de uitbreidende Prisma-migratie uit.");
  const products = await prisma.product.findMany({
    where: { attributes: { some: { key: { startsWith: "faq." } } } },
    select: { id: true, sku: true, attributes: { where: { key: { startsWith: "faq." } }, select: { key: true, value: true } } },
    orderBy: { id: "asc" },
  });
  const migratedProductIds = schemaReady
    ? new Set((await prisma.productFaqSet.findMany({ select: { productId: true } })).map((set) => set.productId))
    : new Set<string>();
  const candidates = products.map((product) => ({ product, entries: parseLegacy(product.attributes) })).filter(({ entries }) => entries.length);
  const pending = candidates.filter(({ product }) => !migratedProductIds.has(product.id));
  const report = { mode: apply ? "apply" : "dry-run", schemaReady, candidateProducts: candidates.length, pendingProducts: pending.length, alreadyMigrated: candidates.length - pending.length, faqItems: pending.reduce((sum, item) => sum + item.entries.length, 0), protectedFingerprints: before, examples: pending.slice(0, SAMPLE_LIMIT).map(({ product, entries }) => ({ productId: product.id, sku: product.sku, items: entries.length, locales: entries.map((entry) => entry.translations.map((translation) => translation.locale)) })) };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;

  const admin = await prisma.adminUser.findFirst({ where: { id: migrationAdminId!, active: true, role: { in: ["OWNER", "ADMIN"] } } });
  if (!admin) throw new Error("De opgegeven migratie-actor is geen actieve OWNER of ADMIN.");
  for (const { product, entries } of pending) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${product.id}, 0))`;
      if (await tx.productFaqSet.findUnique({ where: { productId: product.id }, select: { id: true } })) return;
      const set = await tx.productFaqSet.create({ data: { productId: product.id, aggregateRevision: entries.length } });
      await recordAudit(tx, admin, "ProductFaqSet", set.id, "CREATE", null, {
        productId: product.id,
        source: "LEGACY_PRODUCT_ATTRIBUTES",
      });
      for (const [sortOrder, entry] of entries.entries()) {
        const item = await tx.productFaqItem.create({ data: { faqSetId: set.id, status: "DRAFT", placement: "BELOW_PRODUCT_DETAILS", sortOrder, version: 1 } });
        const revision = await tx.productFaqRevision.create({ data: { itemId: item.id, revision: 1, createdById: admin.id, translations: { create: entry.translations } } });
        await tx.productFaqItem.update({ where: { id: item.id }, data: { draftRevisionId: revision.id, publishedRevisionId: revision.id, status: "PUBLISHED" } });
        await recordAudit(tx, admin, "ProductFaqItem", item.id, "CREATE", null, {
          productId: product.id,
          source: "LEGACY_PRODUCT_ATTRIBUTES",
          legacyIndex: entry.index,
          revisionId: revision.id,
          published: true,
        });
      }
    });
  }
  const after = await protectedFingerprints();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Beschermde data gewijzigd: ${JSON.stringify({ before, after })}`);
  console.log(JSON.stringify({ migratedProducts: pending.length, migrationAdminId: admin.id, protectedFingerprints: after }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
