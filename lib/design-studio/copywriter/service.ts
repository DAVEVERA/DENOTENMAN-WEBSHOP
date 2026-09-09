import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { publicImageUrl } from "@/lib/storage";
import { assessCopywriterCompleteness } from "./completeness";
import {
  copywriterProductDto,
  copywriterProposalDto,
  type CopywriterProductDto,
  type CopywriterProposalDto,
  type CopywriterProposalRecord,
} from "./dto";
import { runCopywriterGeneration } from "./gemini-provider";
import {
  COPYWRITER_REQUIRED_FIELDS,
  copywriterPersistedProposalSchema,
  copywriterProposedFieldsSchema,
  copywriterFieldNameSchema,
  type CopywriterFieldName,
} from "./schema";
import {
  buildCopywriterSourceSnapshot,
  canonicalSourceHash,
  copywriterSourceSnapshotSchema,
  protectedFactsHash,
  type CopywriterSourceSnapshot,
} from "./snapshot";
import { buildGroundedCopywriterProposal } from "./style";

export const copywriterGenerateRequestSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  locale: z.literal("nl"),
}).strict();

export const copywriterEditRequestSchema = z.object({
  edits: z.record(copywriterFieldNameSchema, z.string()).refine((value) => Object.keys(value).length > 0, "Kies ten minste één veld."),
}).strict();

export const copywriterApplyRequestSchema = z.object({
  sourceProductVersion: z.string().datetime(),
  protectedFactsHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  selectedFields: z.array(copywriterFieldNameSchema).min(1).max(COPYWRITER_REQUIRED_FIELDS.length)
    .refine((fields) => new Set(fields).size === fields.length, "Een veld mag maar één keer worden toegepast."),
  confirmation: z.literal("APPLY_SELECTED_FIELDS"),
}).strict();

export class CopywriterServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "CopywriterServiceError";
  }
}

async function copywriterPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

type CopywriterDatabase = PrismaClient | Prisma.TransactionClient;

async function findProduct(database: CopywriterDatabase, productId: string) {
  return database.product.findUnique({
    where: { id: productId },
    include: {
      translations: { where: { locale: "nl" } },
      attributes: { orderBy: { key: "asc" } },
      variants: { orderBy: { id: "asc" } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }], take: 1 },
      productCategories: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        include: { category: { include: { translations: { where: { locale: "nl" }, take: 1 } } } },
      },
    },
  });
}

type LoadedProduct = NonNullable<Awaited<ReturnType<typeof findProduct>>>;

function sourceFromProduct(product: LoadedProduct): CopywriterSourceSnapshot {
  const translation = product.translations[0];
  if (!translation) {
    throw new CopywriterServiceError("NL_TRANSLATION_MISSING", "Dit product heeft geen Nederlandse vertaling.", 422);
  }
  return buildCopywriterSourceSnapshot({
    product: {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      updatedAt: product.updatedAt,
      basePriceCents: product.basePriceCents,
      salePriceCents: product.salePriceCents,
      currency: product.currency,
      unit: product.unit,
      isActive: product.isActive,
    },
    translation: {
      locale: "nl",
      name: translation.name,
      slug: translation.slug,
      shortDescription: translation.shortDescription,
      shortDescriptionHtml: translation.shortDescriptionHtml,
      description: translation.description,
      descriptionHtml: translation.descriptionHtml,
      seoTitle: translation.seoTitle,
      metaDescription: translation.metaDescription,
      promotionText: translation.promotionText,
    },
    attributes: product.attributes.map(({ key, value }) => ({ key, value })),
    categories: product.productCategories.map((assignment) => ({
      id: assignment.categoryId,
      slug: assignment.category.slug,
      name: assignment.category.translations[0]?.name ?? assignment.category.slug,
      parentId: assignment.category.parentId,
      isPrimary: assignment.isPrimary,
      sortOrder: assignment.sortOrder,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      weightGrams: variant.weightGrams,
      preparation: variant.preparation,
      salting: variant.salting,
      coating: variant.coating,
      priceCents: variant.priceCents,
      salePriceCents: variant.salePriceCents,
      stock: variant.stock,
      isActive: variant.isActive,
    })),
  });
}

function imageUrl(product: LoadedProduct): string | null {
  return product.images[0] ? publicImageUrl(product.images[0].storageKey) : null;
}

function proposalRecord(value: {
  id: string;
  productId: string;
  requestedByAdminUserId: string;
  status: string;
  sourceProductVersion: Date;
  sourceSnapshot: unknown;
  proposedFields: unknown;
}): CopywriterProposalRecord {
  if (!["GENERATING", "DRAFT", "APPLIED", "FAILED"].includes(value.status)) {
    throw new CopywriterServiceError("INVALID_PROPOSAL", "Het opgeslagen tekstvoorstel heeft een ongeldige status.", 500);
  }
  return value as CopywriterProposalRecord;
}

export async function listCopywriterProducts(limit = 250): Promise<CopywriterProductDto[]> {
  const database = await copywriterPrisma();
  const products = await database.product.findMany({
    orderBy: [{ slug: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(500, Math.trunc(limit))),
    include: {
      translations: { where: { locale: "nl" } },
      attributes: { orderBy: { key: "asc" } },
      variants: { orderBy: { id: "asc" } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }], take: 1 },
      productCategories: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        include: { category: { include: { translations: { where: { locale: "nl" }, take: 1 } } } },
      },
    },
  });
  return products.map((product) => copywriterProductDto(sourceFromProduct(product), imageUrl(product)));
}

export async function getCopywriterProduct(input: {
  adminUserId: string;
  productId: string;
}): Promise<{ product: CopywriterProductDto; proposal: CopywriterProposalDto | null }> {
  const database = await copywriterPrisma();
  const product = await findProduct(database, input.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const snapshot = sourceFromProduct(product);
  const latest = await database.productCopyProposal.findFirst({
    where: { productId: input.productId, locale: "nl", requestedByAdminUserId: input.adminUserId },
    orderBy: { createdAt: "desc" },
  });
  return {
    product: copywriterProductDto(snapshot, imageUrl(product)),
    proposal: latest?.proposedFields
      ? copywriterProposalDto(proposalRecord(latest), copywriterSourceSnapshotSchema.parse(latest.sourceSnapshot), imageUrl(product))
      : null,
  };
}

export async function createCopywriterProposal(input: {
  adminUserId: string;
  idempotencyKey: string;
  options: z.infer<typeof copywriterGenerateRequestSchema>;
}): Promise<{ proposal: CopywriterProposalDto; replayed: boolean }> {
  const options = copywriterGenerateRequestSchema.parse(input.options);
  const database = await copywriterPrisma();
  const product = await findProduct(database, options.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const snapshot = sourceFromProduct(product);
  const sourceHash = canonicalSourceHash(snapshot);
  const requestHash = canonicalSourceHash({ productId: options.productId, locale: options.locale, sourceHash });
  let record = await database.productCopyProposal.findUnique({ where: { generationIdempotencyKey: input.idempotencyKey } });

  if (record) {
    if (record.requestedByAdminUserId !== input.adminUserId || record.generationRequestHash !== requestHash) {
      throw new CopywriterServiceError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode hoort bij een ander tekstvoorstel.", 409);
    }
    if (record.proposedFields && (record.status === "DRAFT" || record.status === "APPLIED")) {
      return { proposal: copywriterProposalDto(proposalRecord(record), copywriterSourceSnapshotSchema.parse(record.sourceSnapshot), imageUrl(product)), replayed: true };
    }
    if (record.status === "GENERATING") {
      throw new CopywriterServiceError("PROPOSAL_GENERATING", "Dit tekstvoorstel wordt al gemaakt.", 409);
    }
    record = await database.productCopyProposal.update({
      where: { id: record.id },
      data: { status: "GENERATING", errorCode: null, sourceProductVersion: product.updatedAt, sourceHash, sourceSnapshot: snapshot as Prisma.InputJsonValue },
    });
  } else {
    record = await database.productCopyProposal.create({
      data: {
        productId: options.productId,
        locale: "nl",
        requestedByAdminUserId: input.adminUserId,
        status: "GENERATING",
        schemaVersion: 1,
        generationIdempotencyKey: input.idempotencyKey,
        generationRequestHash: requestHash,
        sourceProductVersion: product.updatedAt,
        sourceHash,
        sourceSnapshot: snapshot as Prisma.InputJsonValue,
      },
    });
  }

  try {
    const generated = await runCopywriterGeneration(snapshot);
    const stored = await database.productCopyProposal.update({
      where: { id: record.id },
      data: {
        status: "DRAFT",
        proposedFields: generated.proposal as Prisma.InputJsonValue,
        model: generated.modelId,
        generatedAt: new Date(),
        errorCode: null,
      },
    });
    return { proposal: copywriterProposalDto(proposalRecord(stored), snapshot, imageUrl(product)), replayed: false };
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "GENERATION_FAILED";
    await database.productCopyProposal.update({ where: { id: record.id }, data: { status: "FAILED", errorCode: code } }).catch(() => undefined);
    throw error;
  }
}

export async function editCopywriterProposal(input: {
  adminUserId: string;
  proposalId: string;
  edits: Record<string, string>;
}): Promise<CopywriterProposalDto> {
  const parsed = copywriterEditRequestSchema.parse({ edits: input.edits });
  const database = await copywriterPrisma();
  const record = await database.productCopyProposal.findFirst({
    where: { id: input.proposalId, requestedByAdminUserId: input.adminUserId },
  });
  if (!record) throw new CopywriterServiceError("PROPOSAL_NOT_FOUND", "Het tekstvoorstel bestaat niet.", 404);
  if (record.status !== "DRAFT" || !record.proposedFields) {
    throw new CopywriterServiceError("PROPOSAL_NOT_EDITABLE", "Alleen een conceptvoorstel kan worden bewerkt.", 409);
  }
  const snapshot = copywriterSourceSnapshotSchema.parse(record.sourceSnapshot);
  const persisted = copywriterPersistedProposalSchema.parse(record.proposedFields);
  const fields = structuredClone(persisted.fields);
  for (const [name, value] of Object.entries(parsed.edits) as Array<[CopywriterFieldName, string]>) {
    const field = fields[name];
    if (!field.applyAllowed) throw new CopywriterServiceError("FIELD_LOCKED", `${name} heeft geen gecontroleerde bron.`, 422);
    field.proposed = value;
  }
  copywriterProposedFieldsSchema.parse(fields);
  const grounded = buildGroundedCopywriterProposal(snapshot, { schemaVersion: 1, fields });
  const updated = await database.productCopyProposal.update({
    where: { id: record.id },
    data: { proposedFields: grounded as Prisma.InputJsonValue },
  });
  const product = await findProduct(database, record.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  return copywriterProposalDto(proposalRecord(updated), snapshot, imageUrl(product));
}

function proposalValue(fields: ReturnType<typeof copywriterPersistedProposalSchema.parse>["fields"], field: CopywriterFieldName) {
  const value = fields[field];
  if (!value.applyAllowed || value.proposed === null) {
    throw new CopywriterServiceError("FIELD_LOCKED", `${field} kan niet zonder gecontroleerde bron worden toegepast.`, 422);
  }
  return value.proposed;
}

export async function applyCopywriterProposal(input: {
  adminUserId: string;
  proposalId: string;
  idempotencyKey: string;
  options: z.infer<typeof copywriterApplyRequestSchema>;
}): Promise<{ proposal: CopywriterProposalDto; replayed: boolean }> {
  const options = copywriterApplyRequestSchema.parse(input.options);
  const requestHash = canonicalSourceHash(options);
  const database = await copywriterPrisma();

  const outcome = await database.$transaction(async (tx) => {
    const record = await tx.productCopyProposal.findFirst({
      where: { id: input.proposalId, requestedByAdminUserId: input.adminUserId },
    });
    if (!record) throw new CopywriterServiceError("PROPOSAL_NOT_FOUND", "Het tekstvoorstel bestaat niet.", 404);
    if (record.status === "APPLIED") {
      if (record.applyIdempotencyKey === input.idempotencyKey && record.applyRequestHash === requestHash) {
        return { record, replayed: true };
      }
      throw new CopywriterServiceError("PROPOSAL_ALREADY_APPLIED", "Dit tekstvoorstel is al toegepast.", 409);
    }
    if (record.status !== "DRAFT" || !record.proposedFields) {
      throw new CopywriterServiceError("PROPOSAL_NOT_APPLICABLE", "Dit tekstvoorstel is niet toepasbaar.", 409);
    }
    if (record.applyIdempotencyKey && (record.applyIdempotencyKey !== input.idempotencyKey || record.applyRequestHash !== requestHash)) {
      throw new CopywriterServiceError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode hoort bij een andere toepassing.", 409);
    }
    const product = await findProduct(tx, record.productId);
    if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
    const current = sourceFromProduct(product);
    const persisted = copywriterPersistedProposalSchema.parse(record.proposedFields);
    if (
      product.updatedAt.toISOString() !== record.sourceProductVersion.toISOString()
      || options.sourceProductVersion !== record.sourceProductVersion.toISOString()
      || canonicalSourceHash(current) !== record.sourceHash
      || options.protectedFactsHash !== persisted.protectedFactsHash
      || protectedFactsHash(current) !== persisted.protectedFactsHash
    ) {
      throw new CopywriterServiceError("STALE_PRODUCT", "Het product is intussen gewijzigd. Maak eerst een nieuw voorstel.", 409);
    }

    const selected = options.selectedFields;
    const translation = product.translations[0];
    if (!translation) throw new CopywriterServiceError("NL_TRANSLATION_MISSING", "De Nederlandse vertaling ontbreekt.", 422);
    const translationData: Prisma.ProductTranslationUpdateInput = {};
    const auditRows: Array<{ field: CopywriterFieldName; before: string | null; after: string }> = [];

    for (const field of selected) {
      const after = proposalValue(persisted.fields, field);
      if (field === "ingredients" || field === "allergens" || field === "mayContainTraces") {
        if (after !== current.facts[field]) throw new CopywriterServiceError("FACT_NOT_SOURCE_EXACT", `${field} wijkt af van de gecontroleerde bron.`, 422);
        continue;
      }
      const before = field === "name" || field === "slug"
        ? translation[field]
        : field === "descriptionHtml"
          ? translation.descriptionHtml
          : translation[field];
      auditRows.push({ field, before, after });
      if (field === "descriptionHtml") {
        translationData.descriptionHtml = after;
        translationData.description = (await import("@/lib/product-content")).toProductPlainText(after);
      } else if (field === "shortDescription") {
        translationData.shortDescription = after;
        translationData.shortDescriptionHtml = null;
      } else {
        translationData[field] = after;
      }
    }

    if (selected.includes("slug")) {
      const nextSlug = proposalValue(persisted.fields, "slug");
      const claimedAlias = await tx.productSlugAlias.findUnique({ where: { locale_slug: { locale: "nl", slug: nextSlug } } });
      if (claimedAlias && claimedAlias.productId !== product.id) throw new CopywriterServiceError("SLUG_CONFLICT", "Deze slug is al in gebruik.", 409);
      if (claimedAlias?.productId === product.id) await tx.productSlugAlias.delete({ where: { id: claimedAlias.id } });
      if (translation.slug !== nextSlug) {
        await tx.productSlugAlias.upsert({
          where: { locale_slug: { locale: "nl", slug: translation.slug } },
          update: {},
          create: { productId: product.id, locale: "nl", slug: translation.slug },
        });
      }
    }

    await tx.productTranslation.update({
      where: { productId_locale: { productId: product.id, locale: "nl" } },
      data: translationData,
    });
    await tx.product.update({
      where: { id: product.id },
      data: selected.includes("slug") ? { slug: proposalValue(persisted.fields, "slug") } : { updatedAt: new Date() },
    });
    for (const audit of auditRows) {
      await tx.auditLog.create({
        data: {
          adminUserId: input.adminUserId,
          action: "UPDATE",
          entityType: "ProductTranslation",
          entityId: translation.id,
          before: { field: audit.field, value: audit.before },
          after: { field: audit.field, value: audit.after },
        },
      });
    }
    const updated = await tx.productCopyProposal.update({
      where: { id: record.id },
      data: {
        status: "APPLIED",
        appliedByAdminUserId: input.adminUserId,
        applyIdempotencyKey: input.idempotencyKey,
        applyRequestHash: requestHash,
        appliedFields: selected as Prisma.InputJsonValue,
        appliedAt: new Date(),
      },
    });
    return { record: updated, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });

  const product = await findProduct(database, outcome.record.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const current = sourceFromProduct(product);
  if (!outcome.replayed) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
  }
  return { proposal: copywriterProposalDto(proposalRecord(outcome.record), current, imageUrl(product)), replayed: outcome.replayed };
}

export function analyzeCopywriterSnapshot(snapshot: CopywriterSourceSnapshot) {
  return assessCopywriterCompleteness(snapshot);
}
