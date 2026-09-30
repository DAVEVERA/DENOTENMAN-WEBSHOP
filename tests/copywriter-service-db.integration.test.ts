import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { prisma } from "../lib/prisma";
import type { CopywriterProviderOutput } from "../lib/design-studio/copywriter/schema";
import { canonicalSourceHash, deterministicProductSlug } from "../lib/design-studio/copywriter/snapshot";
import { buildGroundedCopywriterProposal } from "../lib/design-studio/copywriter/style";
import {
  acceptCopywriterField,
  applyCopywriterProposal,
  copywriterSnapshotForProduct,
  getCopywriterProduct,
  listCopywriterProducts,
} from "../lib/design-studio/copywriter/service";

const run = randomUUID().slice(0, 8);
let adminId = "";
let productId = "";
let untranslatedId = "";

const editorial = (proposed: string, evidencePaths = ["translation.name"]) => ({
  proposed,
  applyAllowed: true as const,
  reason: "Maakt de informatie concreet en prettig leesbaar.",
  evidencePaths,
});

const exactFact = (proposed: string, path: string) => ({
  sourceStatus: "SOURCE_EXACT" as const,
  proposed,
  applyAllowed: true as const,
  reason: "Exact uit de geverifieerde bron.",
  evidencePaths: [path],
});

function modelOutput(): CopywriterProviderOutput {
  return {
    schemaVersion: 1,
    fields: {
      name: editorial("Cashewnoten ongebrand"),
      slug: editorial(deterministicProductSlug("Cashewnoten ongebrand", `CW-${run}`)),
      shortDescription: editorial("Ongebrande cashewnoten met een zachte beet.", ["translation.shortDescription"]),
      descriptionHtml: editorial("<p>Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.</p>", ["translation.descriptionHtml"]),
      seoTitle: editorial("Ongebrande cashewnoten | De Notenman", ["translation.name"]),
      metaDescription: editorial("Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.", ["translation.descriptionHtml"]),
      promotionText: { proposed: null, applyAllowed: false, reason: "Er is geen bevestigde actieprijs.", evidencePaths: ["product.salePriceCents"] },
      ingredients: exactFact("CASHEWNOTEN", "facts.ingredients"),
      allergens: exactFact("CASHEWNOTEN", "facts.allergens"),
      mayContainTraces: exactFact("Kan sporen bevatten van andere NOTEN.", "facts.mayContainTraces"),
    },
  };
}

async function insertDraft(options: { superseded?: boolean } = {}) {
  const snapshot = await copywriterSnapshotForProduct(productId);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  return prisma.productCopyProposal.create({
    data: {
      productId,
      locale: "nl",
      requestedByAdminUserId: adminId,
      status: "DRAFT",
      generationIdempotencyKey: `copywriter-test:${randomUUID()}`,
      generationRequestHash: "test",
      sourceProductVersion: product.updatedAt,
      sourceHash: canonicalSourceHash(snapshot),
      sourceSnapshot: snapshot,
      proposedFields: buildGroundedCopywriterProposal(snapshot, modelOutput()),
      supersededAt: options.superseded ? new Date() : null,
    },
  });
}

function applyOptions(proposal: { sourceProductVersion: Date; proposedFields: unknown }, selectedFields: string[]) {
  return {
    sourceProductVersion: proposal.sourceProductVersion.toISOString(),
    protectedFactsHash: (proposal.proposedFields as { protectedFactsHash: string }).protectedFactsHash,
    selectedFields: selectedFields as never,
    confirmation: "APPLY_SELECTED_FIELDS" as const,
  };
}

before(async () => {
  const admin = await prisma.adminUser.create({
    data: { username: `copywriter-test-${run}`, passwordHash: "x", name: "CopyWriter test", role: "ADMIN" },
  });
  adminId = admin.id;
  const product = await prisma.product.create({
    data: {
      slug: `cashewnoten-ongebrand-${run}`,
      sku: `CW-${run}`,
      basePriceCents: 695,
      translations: {
        create: {
          locale: "nl",
          name: "Cashewnoten ongebrand",
          slug: `cashewnoten-ongebrand-${run}`,
          shortDescription: "Ongebrande cashewnoten met een zachte beet.",
          description: "Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.",
          descriptionHtml: "<p>Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.</p>",
          seoTitle: "Ongebrande cashewnoten | De Notenman",
          metaDescription: "Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.",
          promotionText: "Nu extra voordelig",
        },
      },
      attributes: {
        create: [
          { key: "ingredients", value: "CASHEWNOTEN" },
          { key: "allergens", value: "CASHEWNOTEN" },
          { key: "mayContainTraces", value: "Kan sporen bevatten van andere NOTEN." },
        ],
      },
    },
  });
  productId = product.id;
  const untranslated = await prisma.product.create({
    data: { slug: `zonder-vertaling-${run}`, sku: `CW-NT-${run}`, basePriceCents: 100 },
  });
  untranslatedId = untranslated.id;
});

after(async () => {
  await prisma.productCopyFieldReview.deleteMany({ where: { productId: { in: [productId, untranslatedId] } } });
  await prisma.productCopyProposal.deleteMany({ where: { productId: { in: [productId, untranslatedId] } } });
  await prisma.auditLog.deleteMany({ where: { adminUserId: adminId } });
  await prisma.productSlugAlias.deleteMany({ where: { productId: { in: [productId, untranslatedId] } } });
  await prisma.productAttribute.deleteMany({ where: { productId: { in: [productId, untranslatedId] } } });
  await prisma.productTranslation.deleteMany({ where: { productId: { in: [productId, untranslatedId] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productId, untranslatedId] } } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
});

test("one product without a Dutch translation does not break the overview", async () => {
  const products = await listCopywriterProducts(500);
  const untranslated = products.find((item) => item.id === untranslatedId);
  assert.ok(untranslated, "product without translation is listed");
  assert.equal(untranslated.completeness, "MISSING_TEXT");
  assert.match(untranslated.attentionReasons[0] ?? "", /Nederlandse vertaling ontbreekt/);
  assert.ok(products.some((item) => item.id === productId));
});

test("keeping a flagged field clears the review until the text changes", async () => {
  const before = await getCopywriterProduct({ adminUserId: adminId, productId });
  assert.equal(before.product.completeness, "NEEDS_REVIEW");

  const kept = await acceptCopywriterField({ adminUserId: adminId, productId, field: "promotionText" });
  assert.equal(kept.product.completeness, "COMPLETE");
  assert.deepEqual(kept.product.acceptedFields, ["promotionText"]);

  await prisma.productTranslation.update({
    where: { productId_locale: { productId, locale: "nl" } },
    data: { promotionText: "Nu nog voordeliger" },
  });
  const changed = await getCopywriterProduct({ adminUserId: adminId, productId });
  assert.equal(changed.product.completeness, "NEEDS_REVIEW");
  assert.deepEqual(changed.product.acceptedFields, []);

  await assert.rejects(
    acceptCopywriterField({ adminUserId: adminId, productId, field: "seoTitle" }),
    (error: Error & { code?: string }) => error.code === "FIELD_NOT_IN_REVIEW",
  );
  await prisma.productCopyFieldReview.deleteMany({ where: { productId } });
});

test("a superseded draft cannot be applied", async () => {
  const old = await insertDraft({ superseded: true });
  await assert.rejects(
    applyCopywriterProposal({
      adminUserId: adminId,
      proposalId: old.id,
      idempotencyKey: `copywriter-test:${randomUUID()}`,
      options: applyOptions(old, ["seoTitle"]),
    }),
    (error: Error & { code?: string }) => error.code === "PROPOSAL_SUPERSEDED",
  );
});

test("applying the cleared promotion text makes the product complete and closes the draft", async () => {
  const draft = await insertDraft();
  const loaded = await getCopywriterProduct({ adminUserId: adminId, productId });
  assert.equal(loaded.proposal?.id, draft.id);
  assert.equal(loaded.proposal?.stale, false);

  const result = await applyCopywriterProposal({
    adminUserId: adminId,
    proposalId: draft.id,
    idempotencyKey: `copywriter-test:${randomUUID()}`,
    options: applyOptions(draft, ["promotionText", "ingredients"]),
  });
  assert.equal(result.proposal.status, "APPLIED");
  assert.equal(result.proposal.product.completeness, "COMPLETE");

  const translation = await prisma.productTranslation.findUniqueOrThrow({ where: { productId_locale: { productId, locale: "nl" } } });
  assert.equal(translation.promotionText, null);
  const stored = await prisma.productCopyProposal.findUniqueOrThrow({ where: { id: draft.id } });
  assert.deepEqual(stored.appliedFields, ["promotionText"], "product facts are never recorded as applied");

  const reloaded = await getCopywriterProduct({ adminUserId: adminId, productId });
  assert.equal(reloaded.product.completeness, "COMPLETE");
  assert.equal(reloaded.proposal, null, "applied proposals are not reopened");
  assert.equal(reloaded.product.latestProposal?.status, "APPLIED");
});
