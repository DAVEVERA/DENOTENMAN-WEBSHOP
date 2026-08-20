import { PrismaClient } from "@prisma/client";
import { hashAdminPassword } from "../lib/admin-auth";
import { changeFaqStatus, createFaqItem } from "../lib/product-faq-db";
import { prisma } from "../lib/prisma";

const databaseUrl = process.env.DATABASE_URL ?? "";
const parsedUrl = new URL(databaseUrl);
const schema = parsedUrl.searchParams.get("schema") ?? "";
if (!/^qa_product_faq_[a-z0-9_]+$/.test(schema)) {
  throw new Error("Browser QA seed refuses a non-QA database schema.");
}

const publicUrl = new URL(databaseUrl);
publicUrl.searchParams.set("schema", "public");
const publicPrisma = new PrismaClient({ datasourceUrl: publicUrl.toString() });

async function main() {
  const sourceImage = await publicPrisma.productImage.findFirst({
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { storageKey: true },
  });
  if (!sourceImage) throw new Error("Geen bestaande bronafbeelding gevonden voor browser-QA.");

  const admin = await prisma.adminUser.create({
    data: {
      id: "faq-browser-owner",
      username: "faq-browser-owner",
      passwordHash: await hashAdminPassword("FaqBrowserQA!2026"),
      name: "FAQ Browser QA",
      role: "OWNER",
    },
  });
  const product = await prisma.product.create({
    data: {
      id: "faq-browser-product",
      slug: "faq-browser-product",
      sku: "FAQ-BROWSER-PRODUCT",
      basePriceCents: 499,
      translations: {
        create: [
          { locale: "nl", name: "FAQ Browserproduct", slug: "faq-browser-product", description: "Browser-QA productomschrijving." },
          { locale: "en", name: "FAQ browser product", slug: "faq-browser-product", description: "Browser QA description." },
          { locale: "fr", name: "Produit FAQ navigateur", slug: "faq-browser-product", description: "Description QA navigateur." },
        ],
      },
      variants: {
        create: {
          id: "faq-browser-variant",
          sku: "FAQ-BROWSER-500",
          priceCents: 499,
          stock: 25,
          weightGrams: 500,
          preparation: "RAW",
          salting: "UNSALTED",
          coating: "NONE",
          translations: { create: [{ locale: "nl", label: "500 gram" }, { locale: "en", label: "500 grams" }, { locale: "fr", label: "500 grammes" }] },
        },
      },
      images: {
        create: { id: "faq-browser-image", storageKey: sourceImage.storageKey, alt: "FAQ Browserproduct", isPrimary: true },
      },
    },
  });

  const placements = ["BELOW_DESCRIPTION", "BELOW_PRODUCT_DETAILS", "BEFORE_REVIEWS", "PAGE_BOTTOM"] as const;
  let expectedRevision = 0;
  for (const [index, placement] of placements.entries()) {
    const itemId = await createFaqItem(product.id, admin, {
      expectedRevision,
      idempotencyKey: `browser-create-${index}`,
      placement,
      translations: [
        { locale: "nl", question: `Testvraag ${index + 1}?`, answerHtml: `<p>Dit is testantwoord ${index + 1} voor ${placement}.</p>` },
        { locale: "en", question: `Test question ${index + 1}?`, answerHtml: `<p>This is test answer ${index + 1}.</p>` },
        { locale: "fr", question: `Question test ${index + 1} ?`, answerHtml: `<p>Voici la réponse test ${index + 1}.</p>` },
      ],
    });
    expectedRevision += 1;
    await changeFaqStatus(product.id, itemId, admin, {
      expectedRevision,
      itemVersion: 1,
      idempotencyKey: `browser-publish-${index}`,
    }, "PUBLISHED");
    expectedRevision += 1;
  }

  console.log(JSON.stringify({ schema, adminId: admin.id, productId: product.id, imageId: "faq-browser-image" }));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await Promise.all([prisma.$disconnect(), publicPrisma.$disconnect()]); });
