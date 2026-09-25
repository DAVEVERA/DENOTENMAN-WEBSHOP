import { prisma } from "../lib/prisma";
import { createFaqItem } from "../lib/product-faq-db";
import { getAdminProductFaqSet } from "../lib/product-faq";
import { generateProductFaqSuggestions } from "../lib/product-faq-ai";
import { loadProductFaqFactCard } from "../lib/product-faq-ai-service";

// Dry-run by default. Pass --apply to actually write draft FAQ items. Nothing is ever
// published automatically — every item lands as DRAFT, exactly like the admin "Genereer met
// AI" button, so a human still reviews and publishes each one.
const apply = process.argv.includes("--apply");
const MIN_TARGET_ITEMS = 3;
const DEFAULT_BATCH_SIZE = 20;

function argumentValue(name: string): string | null {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

const adminId = argumentValue("--admin-id");
const limitArgument = Number(argumentValue("--limit") ?? DEFAULT_BATCH_SIZE);
const limit = Number.isFinite(limitArgument) && limitArgument > 0 ? Math.trunc(limitArgument) : DEFAULT_BATCH_SIZE;

function escapeFaqAiAnswer(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ProductResult = { productId: string; sku: string; generated: number; added: number; error?: string };

async function main() {
  if (apply && !adminId) throw new Error("Gebruik --admin-id=<id> bij --apply voor expliciet auteurschap en auditprovenance.");

  const admin = apply
    ? await prisma.adminUser.findFirst({ where: { id: adminId!, active: true, role: { in: ["OWNER", "ADMIN"] } } })
    : null;
  if (apply && !admin) throw new Error("De opgegeven actor is geen actieve OWNER of ADMIN.");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, faqSet: { select: { items: { where: { deletedAt: null }, select: { id: true } } } } },
    orderBy: { id: "asc" },
  });

  const candidates = products.filter((product) => (product.faqSet?.items.length ?? 0) < MIN_TARGET_ITEMS);
  const batch = candidates.slice(0, limit);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    totalActiveProducts: products.length,
    productsBelowTarget: candidates.length,
    batchSize: batch.length,
  }, null, 2));

  const results: ProductResult[] = [];
  for (const product of batch) {
    try {
      const [factCard, faqSet] = await Promise.all([
        loadProductFaqFactCard(product.id),
        getAdminProductFaqSet(product.id),
      ]);
      const existingQuestions = faqSet.items.flatMap((item) =>
        [item.draft, item.published].flatMap((revision) =>
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
      results.push({ productId: product.id, sku: product.sku, generated: suggestions.length, added });
    } catch (error) {
      results.push({ productId: product.id, sku: product.sku, generated: 0, added: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ results }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
