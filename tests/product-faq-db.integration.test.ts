import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  changeFaqStatus,
  createFaqItem,
  deleteFaqItem,
  ProductFaqError,
  reorderFaqItems,
  saveFaqDraft,
} from "../lib/product-faq-db";
import { getAdminProductFaqSet, getStorefrontProductFaqs } from "../lib/product-faq";

const databaseUrl = process.env.DATABASE_URL ?? "";
const schema = (() => {
  try { return new URL(databaseUrl).searchParams.get("schema") ?? ""; }
  catch { return ""; }
})();
const enabled = process.env.RUN_FAQ_DB_INTEGRATION === "1";

test("FAQ DAL preserves published revisions and enforces aggregate, item and pointer guards", { skip: !enabled }, async () => {
  const url = new URL(databaseUrl);
  const isolatedLocalRelease = url.hostname === "127.0.0.1" && url.port === "55435" && url.pathname === "/notenman_release_qa";
  assert.ok(isolatedLocalRelease || /^qa_product_faq_[a-z0-9_]+$/.test(schema), "Integration test refuses a non-QA database target");
  const suffix = randomUUID().replaceAll("-", "");
  const admin = await prisma.adminUser.create({
    data: { username: `faq-qa-${suffix}`, passwordHash: "not-used", name: "FAQ QA", role: "OWNER" },
  });
  const product = await prisma.product.create({
    data: { slug: `faq-qa-${suffix}`, sku: `FAQ-QA-${suffix}`, basePriceCents: 100 },
  });
  const otherProduct = await prisma.product.create({
    data: { slug: `faq-qa-other-${suffix}`, sku: `FAQ-QA-OTHER-${suffix}`, basePriceCents: 100 },
  });

  const key = (name: string) => `${name}:${suffix}`;
  try {
    const firstId = await createFaqItem(product.id, admin, {
      expectedRevision: 0,
      idempotencyKey: key("create-first"),
      placement: "BELOW_PRODUCT_DETAILS",
      translations: [{ locale: "nl", question: "Eerste vraag?", answerHtml: "<p>Eerste antwoord.</p>" }],
    });
    assert.equal(await createFaqItem(product.id, admin, {
      expectedRevision: 0,
      idempotencyKey: key("create-first"),
      placement: "BELOW_PRODUCT_DETAILS",
      translations: [{ locale: "nl", question: "Eerste vraag?", answerHtml: "<p>Eerste antwoord.</p>" }],
    }), firstId, "exact idempotent replay returns the original item");

    const secondId = await createFaqItem(product.id, admin, {
      expectedRevision: 1,
      idempotencyKey: key("create-second"),
      placement: "PAGE_BOTTOM",
      translations: [{ locale: "nl", question: "Tweede vraag?", answerHtml: "<p>Tweede antwoord.</p>" }],
    });

    await saveFaqDraft(product.id, firstId, admin, {
      expectedRevision: 2,
      itemVersion: 1,
      idempotencyKey: key("save-v2"),
      placement: "BELOW_DESCRIPTION",
      translations: [{ locale: "nl", question: "Vraag versie twee?", answerHtml: "<p>Antwoord versie twee.</p>" }],
    });
    await changeFaqStatus(product.id, firstId, admin, {
      expectedRevision: 3, itemVersion: 2, idempotencyKey: key("publish-v2"),
    }, "PUBLISHED");
    assert.equal((await getStorefrontProductFaqs(product.id, "nl")).BELOW_DESCRIPTION[0]?.question, "Vraag versie twee?");
    assert.equal((await getStorefrontProductFaqs(product.id, "en")).BELOW_DESCRIPTION.length, 0, "no locale fallback");

    await saveFaqDraft(product.id, firstId, admin, {
      expectedRevision: 4,
      itemVersion: 3,
      idempotencyKey: key("save-v3"),
      placement: "BELOW_DESCRIPTION",
      translations: [{ locale: "nl", question: "Vraag versie drie?", answerHtml: "<p>Antwoord versie drie.</p>" }],
    });
    assert.equal((await getStorefrontProductFaqs(product.id, "nl")).BELOW_DESCRIPTION[0]?.question, "Vraag versie twee?", "draft edit does not replace live revision");
    await changeFaqStatus(product.id, firstId, admin, {
      expectedRevision: 5, itemVersion: 4, idempotencyKey: key("publish-v3"),
    }, "PUBLISHED");
    assert.equal((await getStorefrontProductFaqs(product.id, "nl")).BELOW_DESCRIPTION[0]?.question, "Vraag versie drie?");

    await changeFaqStatus(product.id, firstId, admin, {
      expectedRevision: 6, itemVersion: 5, idempotencyKey: key("hide"),
    }, "HIDDEN");
    assert.equal((await getStorefrontProductFaqs(product.id, "nl")).BELOW_DESCRIPTION.length, 0);
    await changeFaqStatus(product.id, firstId, admin, {
      expectedRevision: 7, itemVersion: 6, idempotencyKey: key("republish"),
    }, "PUBLISHED");

    await reorderFaqItems(product.id, admin, {
      expectedRevision: 8, idempotencyKey: key("reorder"), itemIds: [secondId, firstId],
    });
    let canonical = await getAdminProductFaqSet(product.id);
    assert.deepEqual(canonical.items.map((item) => item.id), [secondId, firstId]);

    await assert.rejects(
      saveFaqDraft(otherProduct.id, secondId, admin, {
        expectedRevision: 0,
        itemVersion: canonical.items[0].version,
        idempotencyKey: key("cross-product"),
        placement: "PAGE_BOTTOM",
        translations: [{ locale: "nl", question: "IDOR?", answerHtml: "<p>Nee.</p>" }],
      }),
      (error: unknown) => error instanceof ProductFaqError && error.code === "FAQ_NOT_FOUND",
    );
    await assert.rejects(
      createFaqItem(product.id, admin, {
        expectedRevision: 0,
        idempotencyKey: key("stale-set"),
        placement: "PAGE_BOTTOM",
        translations: [],
      }),
      (error: unknown) => error instanceof ProductFaqError && error.code === "STALE_FAQ_SET",
    );

    const firstRevision = await prisma.productFaqRevision.findFirstOrThrow({ where: { itemId: firstId } });
    await assert.rejects(prisma.$executeRaw`
      UPDATE "ProductFaqItem" SET "publishedRevisionId" = ${firstRevision.id} WHERE "id" = ${secondId}
    `, /published revision does not belong to FAQ item/);
    await assert.rejects(prisma.productFaqItem.update({
      where: { id: secondId }, data: { status: "PUBLISHED", publishedRevisionId: null },
    }));

    canonical = await getAdminProductFaqSet(product.id);
    const first = canonical.items.find((item) => item.id === firstId);
    assert.ok(first);
    await deleteFaqItem(product.id, firstId, admin, {
      expectedRevision: canonical.revision,
      itemVersion: first.version,
      idempotencyKey: key("delete"),
    });
    assert.equal((await getAdminProductFaqSet(product.id)).items.some((item) => item.id === firstId), false);
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: [product.id, otherProduct.id] } } });
    await prisma.auditLog.deleteMany({ where: { adminUserId: admin.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  }
});
