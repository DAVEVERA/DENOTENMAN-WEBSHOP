import { prisma } from "../lib/prisma";
import { createFaqItem, deleteFaqItem } from "../lib/product-faq-db";
import { getAdminProductFaqSet } from "../lib/product-faq";
import { generateProductFaqSuggestions } from "../lib/product-faq-ai";
import { loadProductFaqFactCard } from "../lib/product-faq-ai-service";

// Dry-run by default. Pass --apply to actually write draft FAQ items. Nothing is ever
// published automatically — every item lands as DRAFT, exactly like the admin "Genereer met
// AI" button, so a human still reviews and publishes each one. Published items are never
// touched or removed by this script, in any mode.
const apply = process.argv.includes("--apply");
// Default mode only fills products below MIN_TARGET_ITEMS. --all instead refreshes every
// active product: any of ITS OWN existing DRAFT items (e.g. from an earlier run of this
// script) are deleted first, then a fresh 3-5 set is generated — a full "replace", never
// touching PUBLISHED items.
const refreshAll = process.argv.includes("--all");
const MIN_TARGET_ITEMS = 3;
const DEFAULT_BATCH_SIZE = 20;

function argumentValue(name: string): string | null {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

const adminId = argumentValue("--admin-id");
const adminUsername = argumentValue("--admin-username");
const limitArgument = Number(argumentValue("--limit") ?? DEFAULT_BATCH_SIZE);
const limit = Number.isFinite(limitArgument) && limitArgument > 0 ? Math.trunc(limitArgument) : DEFAULT_BATCH_SIZE;

function escapeFaqAiAnswer(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ProductResult = { productId: string; sku: string; removed: number; generated: number; added: number; error?: string };

async function main() {
  if (apply && !adminId && !adminUsername) {
    throw new Error("Gebruik --admin-id=<id> of --admin-username=<username> bij --apply voor expliciet auteurschap en auditprovenance.");
  }

  const admin = apply
    ? await prisma.adminUser.findFirst({
        where: {
          active: true,
          role: { in: ["OWNER", "ADMIN"] },
          ...(adminId ? { id: adminId } : { username: adminUsername! }),
        },
      })
    : null;
  if (apply && !admin) throw new Error("De opgegeven actor is geen actieve OWNER of ADMIN.");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, faqSet: { select: { items: { where: { deletedAt: null }, select: { id: true } } } } },
    orderBy: { id: "asc" },
  });

  const candidates = refreshAll
    ? products
    : products.filter((product) => (product.faqSet?.items.length ?? 0) < MIN_TARGET_ITEMS);
  const batch = candidates.slice(0, limit);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    scope: refreshAll ? "all-active-products" : "below-target-only",
    totalActiveProducts: products.length,
    productsBelowTarget: products.filter((product) => (product.faqSet?.items.length ?? 0) < MIN_TARGET_ITEMS).length,
    candidateCount: candidates.length,
    batchSize: batch.length,
  }, null, 2));

  const results: ProductResult[] = [];
  for (const product of batch) {
    try {
      const [factCard, faqSet] = await Promise.all([
        loadProductFaqFactCard(product.id),
        getAdminProductFaqSet(product.id),
      ]);

      let removed = 0;
      if (refreshAll && apply) {
        for (const item of faqSet.items.filter((entry) => entry.status === "DRAFT")) {
          const current = await prisma.productFaqSet.findUnique({ where: { productId: product.id }, select: { aggregateRevision: true } });
          await deleteFaqItem(product.id, item.id, admin!, {
            expectedRevision: current?.aggregateRevision ?? 0,
            itemVersion: item.version,
            idempotencyKey: crypto.randomUUID(),
          });
          removed += 1;
        }
      }

      // Only PUBLISHED questions still count as "existing" — in --all mode any DRAFT
      // question is either already removed above or about to be replaced, so it must not
      // suppress a similar fresh suggestion.
      const existingQuestions = faqSet.items.flatMap((item) =>
        (refreshAll ? [item.published] : [item.draft, item.published]).flatMap((revision) =>
          revision?.translations.filter((translation) => translation.locale === "nl").map((translation) => translation.question) ?? []
        )
      );
      const suggestions = await generateProductFaqSuggestions({ factCard, existingQuestions });
      let added = 0;
      if (apply) {
        for (const suggestion of suggestions) {
          const current = await prisma.productFaqSet.findUnique({ where: { productId: product.id }, select: { aggregateRevision: true } });
          await createFaqItem(product.id, admin!, {
            expectedRevision: current?.aggregateRevision ?? 0,
            idempotencyKey: crypto.randomUUID(),
            placement: "BELOW_PRODUCT_DETAILS",
            translations: [{ locale: "nl", question: suggestion.question, answerHtml: `<p>${escapeFaqAiAnswer(suggestion.answer)}</p>`, mediaLabel: null }],
          });
          added += 1;
        }
      }
      results.push({ productId: product.id, sku: product.sku, removed, generated: suggestions.length, added });
    } catch (error) {
      results.push({ productId: product.id, sku: product.sku, removed: 0, generated: 0, added: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ results }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
