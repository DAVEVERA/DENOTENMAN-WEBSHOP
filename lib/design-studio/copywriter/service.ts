import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { publicImageUrl } from "@/lib/storage";
import { assessCopywriterCompleteness } from "./completeness";
import {
  copywriterFieldLabel,
  copywriterProductDto,
  copywriterProposalDto,
  currentValue,
  type CopywriterLatestProposalDto,
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
  COPYWRITER_NUTRITION_ATTRIBUTE_KEYS,
  isCopywriterNutritionField,
  isCopywriterProductInfoField,
  type CopywriterEditorialFieldName,
  type CopywriterFieldName,
  type CopywriterProductInfoFieldName,
} from "./schema";
import {
  buildCopywriterSourceSnapshot,
  canonicalSourceHash,
  copywriterFieldValueHash,
  copywriterProductInfoValue,
  copywriterSourceSnapshotSchema,
  protectedFactsHash,
  type CopywriterSourceSnapshot,
} from "./snapshot";
import { CopywriterGroundingError, buildGroundedCopywriterProposal } from "./style";

export const copywriterGenerateRequestSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  locale: z.literal("nl"),
}).strict();

export const copywriterEditRequestSchema = z.object({
  edits: z.record(copywriterFieldNameSchema, z.string()).refine((value) => Object.keys(value).length > 0, "Kies ten minste één veld."),
}).strict();

export const copywriterAcceptFieldRequestSchema = z.object({
  field: copywriterFieldNameSchema,
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

const groundingErrorMessages: Record<string, string> = {
  SOURCE_INSTRUCTION_DETECTED: "De brondata bevat tekst die als instructie wordt herkend. Neem contact op met techniek voordat je verdergaat.",
  FACT_NOT_SOURCE_EXACT: "Deze productinfo staat al bij het product en blijft zoals die is. Pas een bestaande waarde aan bij het product zelf.",
  FACT_SOURCE_STATUS_INVALID: "De brontoestand van dit productfeit is ongeldig.",
  SLUG_NOT_DETERMINISTIC: "Deze slug komt niet overeen met de productnaam.",
  PROMOTION_NOT_VERIFIED: "Productactietekst kan niet worden voorgesteld zonder een bevestigde, lagere actieprijs.",
  UNSUPPORTED_CLAIM: "Deze tekst bevat een claim die niet terug te vinden is in de brondata. Pas de tekst aan zodat elke claim letterlijk in de productbron staat.",
  UNSUPPORTED_EVIDENCE_PATH: "Dit voorstel verwijst naar een bronpad dat niet is toegestaan.",
};

function toCopywriterServiceError(error: CopywriterGroundingError): CopywriterServiceError {
  return new CopywriterServiceError(
    error.code,
    groundingErrorMessages[error.code] ?? "Deze bewerking kan niet veilig aan de productbron worden gekoppeld.",
    422,
  );
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
      copyFieldReviews: { where: { locale: "nl" } },
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

/** A GENERATING row older than this is treated as abandoned (for example a crashed request). */
const GENERATION_STALE_AFTER_MS = 2 * 60 * 1000;

function acceptedFieldsFor(
  product: Pick<LoadedProduct, "copyFieldReviews">,
  snapshot: CopywriterSourceSnapshot,
): Set<CopywriterFieldName> {
  const accepted = new Set<CopywriterFieldName>();
  for (const review of product.copyFieldReviews) {
    const field = copywriterFieldNameSchema.safeParse(review.field);
    if (field.success && review.valueHash === copywriterFieldValueHash(currentValue(snapshot, field.data))) {
      accepted.add(field.data);
    }
  }
  return accepted;
}

function latestProposalDto(row: {
  status: string;
  createdAt: Date;
  appliedAt: Date | null;
  errorCode: string | null;
} | null | undefined): CopywriterLatestProposalDto | null {
  if (!row || !["GENERATING", "DRAFT", "APPLIED", "FAILED"].includes(row.status)) return null;
  return {
    status: row.status as CopywriterLatestProposalDto["status"],
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    errorCode: row.errorCode,
  };
}

function missingTranslationDto(product: LoadedProduct, latestProposal: CopywriterLatestProposalDto | null): CopywriterProductDto {
  return {
    id: product.id,
    name: product.slug,
    sku: product.sku,
    imageUrl: imageUrl(product),
    active: product.isActive,
    updatedAt: product.updatedAt.toISOString(),
    completeness: "MISSING_TEXT",
    attentionReasons: ["Nederlandse vertaling ontbreekt. Vul die eerst aan bij het product."],
    attentionFields: [],
    acceptedFields: [],
    latestProposal,
  };
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
      copyFieldReviews: { where: { locale: "nl" } },
    },
  });
  const latestByProduct = new Map((await database.productCopyProposal.findMany({
    where: { productId: { in: products.map((product) => product.id) }, locale: "nl" },
    orderBy: [{ productId: "asc" }, { createdAt: "desc" }],
    distinct: ["productId"],
    select: { productId: true, status: true, createdAt: true, appliedAt: true, errorCode: true },
  })).map((row) => [row.productId, latestProposalDto(row)]));
  return products.map((product) => {
    const latestProposal = latestByProduct.get(product.id) ?? null;
    try {
      const snapshot = sourceFromProduct(product);
      return copywriterProductDto(snapshot, imageUrl(product), {
        acceptedFields: acceptedFieldsFor(product, snapshot),
        latestProposal,
      });
    } catch (error) {
      // One product without a Dutch translation must not hide the whole catalog.
      if (error instanceof CopywriterServiceError && error.code === "NL_TRANSLATION_MISSING") {
        return missingTranslationDto(product, latestProposal);
      }
      throw error;
    }
  });
}

export async function getCopywriterProduct(input: {
  adminUserId: string;
  productId: string;
}): Promise<{ product: CopywriterProductDto; proposal: CopywriterProposalDto | null }> {
  const database = await copywriterPrisma();
  const product = await findProduct(database, input.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const snapshot = sourceFromProduct(product);
  const acceptedFields = acceptedFieldsFor(product, snapshot);
  // Drafts belong to the product, not to the admin who requested them. Applied
  // proposals are finished work and are not reopened; the product shows its live text.
  const [latestAttempt, openDraft] = await Promise.all([
    database.productCopyProposal.findFirst({
      where: { productId: input.productId, locale: "nl" },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, appliedAt: true, errorCode: true },
    }),
    database.productCopyProposal.findFirst({
      where: { productId: input.productId, locale: "nl", status: "DRAFT", supersededAt: null, proposedFields: { not: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const latestProposal = latestProposalDto(latestAttempt);
  return {
    product: copywriterProductDto(snapshot, imageUrl(product), { acceptedFields, latestProposal }),
    proposal: openDraft
      ? copywriterProposalDto(proposalRecord(openDraft), copywriterSourceSnapshotSchema.parse(openDraft.sourceSnapshot), imageUrl(product), {
        currentSnapshot: snapshot,
        acceptedFields,
        latestProposal,
        stale: canonicalSourceHash(snapshot) !== openDraft.sourceHash,
      })
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
  const acceptedFields = acceptedFieldsFor(product, snapshot);
  const staleBefore = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
  const generatingError = () => new CopywriterServiceError(
    "PROPOSAL_GENERATING",
    "Er wordt al een voorstel geschreven voor dit product. Wacht even en laad de pagina opnieuw.",
    409,
  );
  let record = await database.productCopyProposal.findUnique({ where: { generationIdempotencyKey: input.idempotencyKey } });

  if (record) {
    if (record.requestedByAdminUserId !== input.adminUserId || record.generationRequestHash !== requestHash) {
      throw new CopywriterServiceError("IDEMPOTENCY_CONFLICT", "Deze aanvraagcode hoort bij een ander tekstvoorstel.", 409);
    }
    if (record.proposedFields && (record.status === "DRAFT" || record.status === "APPLIED")) {
      return {
        proposal: copywriterProposalDto(proposalRecord(record), copywriterSourceSnapshotSchema.parse(record.sourceSnapshot), imageUrl(product), {
          currentSnapshot: snapshot,
          acceptedFields,
          latestProposal: latestProposalDto(record),
          stale: sourceHash !== record.sourceHash,
        }),
        replayed: true,
      };
    }
    if (record.status === "GENERATING" && record.updatedAt > staleBefore) throw generatingError();
    // Compare-and-set: two retries of the same failed (or abandoned) request never both call Gemini.
    const claimed = await database.productCopyProposal.updateMany({
      where: { id: record.id, status: record.status, updatedAt: record.updatedAt },
      data: { status: "GENERATING", errorCode: null, sourceProductVersion: product.updatedAt, sourceHash, sourceSnapshot: snapshot as Prisma.InputJsonValue },
    });
    if (claimed.count !== 1) throw generatingError();
    record = await database.productCopyProposal.findUniqueOrThrow({ where: { id: record.id } });
  } else {
    const running = await database.productCopyProposal.findFirst({
      where: { productId: options.productId, locale: "nl", status: "GENERATING", updatedAt: { gt: staleBefore } },
      select: { id: true },
    });
    if (running) throw generatingError();
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
    const recordId = record.id;
    const stored = await database.$transaction(async (tx) => {
      const draft = await tx.productCopyProposal.update({
        where: { id: recordId },
        data: {
          status: "DRAFT",
          proposedFields: generated.proposal as Prisma.InputJsonValue,
          model: generated.modelId,
          generatedAt: new Date(),
          errorCode: null,
        },
      });
      // Only the newest draft of a product is shown and can be applied.
      await tx.productCopyProposal.updateMany({
        where: { productId: options.productId, locale: "nl", status: "DRAFT", supersededAt: null, id: { not: recordId } },
        data: { supersededAt: new Date() },
      });
      return draft;
    });
    return {
      proposal: copywriterProposalDto(proposalRecord(stored), snapshot, imageUrl(product), {
        acceptedFields,
        latestProposal: latestProposalDto(stored),
      }),
      replayed: false,
    };
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
  const record = await database.productCopyProposal.findUnique({ where: { id: input.proposalId } });
  if (!record) throw new CopywriterServiceError("PROPOSAL_NOT_FOUND", "Het tekstvoorstel bestaat niet.", 404);
  if (record.supersededAt) throw supersededError();
  if (record.status !== "DRAFT" || !record.proposedFields) {
    throw new CopywriterServiceError("PROPOSAL_NOT_EDITABLE", "Alleen een conceptvoorstel kan worden bewerkt.", 409);
  }
  const snapshot = copywriterSourceSnapshotSchema.parse(record.sourceSnapshot);
  const persisted = copywriterPersistedProposalSchema.parse(record.proposedFields);
  const fields = structuredClone(persisted.fields);
  for (const [name, value] of Object.entries(parsed.edits) as Array<[CopywriterFieldName, string]>) {
    const field = fields[name];
    if (!field.applyAllowed) throw new CopywriterServiceError("FIELD_LOCKED", `${copywriterFieldLabel(name)} heeft geen voorstel om aan te passen.`, 422);
    if (isCopywriterProductInfoField(name) && "sourceStatus" in field && field.sourceStatus === "AI_ESTIMATE") {
      // An edited estimate is no longer the model's value: label it as entered by the admin.
      Object.assign(field, { sourceStatus: "ADMIN_ENTERED", reason: "Aangepast in de CopyWriter." });
    }
    field.proposed = value;
  }
  copywriterProposedFieldsSchema.parse(fields);
  let grounded;
  try {
    // skipSlugDeterminism: a manual, per-field edit legitimately breaks the AI's name/slug pairing
    // (e.g. editing only "name"); that is not a hallucination and must not block saving the edit.
    grounded = buildGroundedCopywriterProposal(snapshot, { schemaVersion: 1, fields }, { skipSlugDeterminism: true, allowAdminEntered: true });
  } catch (error) {
    if (error instanceof CopywriterGroundingError) throw toCopywriterServiceError(error);
    throw error;
  }
  const saved = await database.productCopyProposal.updateMany({
    where: { id: record.id, status: "DRAFT", supersededAt: null },
    data: { proposedFields: grounded as Prisma.InputJsonValue },
  });
  if (saved.count !== 1) {
    throw new CopywriterServiceError("PROPOSAL_NOT_EDITABLE", "Dit voorstel is intussen opgeslagen of vervangen. Laad de pagina opnieuw.", 409);
  }
  const updated = await database.productCopyProposal.findUniqueOrThrow({ where: { id: record.id } });
  const product = await findProduct(database, record.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const current = sourceFromProduct(product);
  return copywriterProposalDto(proposalRecord(updated), snapshot, imageUrl(product), {
    currentSnapshot: current,
    acceptedFields: acceptedFieldsFor(product, current),
    latestProposal: latestProposalDto(updated),
    stale: canonicalSourceHash(current) !== updated.sourceHash,
  });
}

function productInfoAttributeKey(field: CopywriterProductInfoFieldName): string {
  return isCopywriterNutritionField(field) ? COPYWRITER_NUTRITION_ATTRIBUTE_KEYS[field] : field;
}

function supersededError() {
  return new CopywriterServiceError("PROPOSAL_SUPERSEDED", "Er is een nieuwer voorstel voor dit product. Laad de pagina opnieuw.", 409);
}

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
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

  const runApply = () => database.$transaction(async (tx) => {
    const record = await tx.productCopyProposal.findUnique({ where: { id: input.proposalId } });
    if (!record) throw new CopywriterServiceError("PROPOSAL_NOT_FOUND", "Het tekstvoorstel bestaat niet.", 404);
    if (record.status === "APPLIED") {
      if (record.applyIdempotencyKey === input.idempotencyKey && record.applyRequestHash === requestHash) {
        return { record, replayed: true };
      }
      throw new CopywriterServiceError("PROPOSAL_ALREADY_APPLIED", "Dit tekstvoorstel is al toegepast.", 409);
    }
    if (record.supersededAt) throw supersededError();
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

    const selected = options.selectedFields.filter((field): field is CopywriterEditorialFieldName => !isCopywriterProductInfoField(field));
    // Product info (facts and nutrition) is stored as product attributes. A value copied
    // from the product is left untouched; only estimates and entered values are written.
    const selectedInfo = options.selectedFields.filter(isCopywriterProductInfoField);
    const infoWrites: Array<{ field: CopywriterProductInfoFieldName; key: string; before: string | null; after: string }> = [];
    for (const field of selectedInfo) {
      const after = proposalValue(persisted.fields, field);
      const before = copywriterProductInfoValue(current, field);
      if (after !== before) infoWrites.push({ field, key: productInfoAttributeKey(field), before, after });
    }
    if (selected.length === 0 && infoWrites.length === 0) {
      throw new CopywriterServiceError("NOTHING_SELECTED", "Kies ten minste één veld om op te slaan.", 422);
    }
    const translation = product.translations[0];
    if (!translation) throw new CopywriterServiceError("NL_TRANSLATION_MISSING", "De Nederlandse vertaling ontbreekt.", 422);
    const translationData: Prisma.ProductTranslationUpdateInput = {};
    const auditRows: Array<{ field: CopywriterFieldName; before: string | null; after: string }> = [];

    for (const field of selected) {
      const after = proposalValue(persisted.fields, field);
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
      } else if (field === "promotionText") {
        // An empty proposal clears the promotion text.
        translationData.promotionText = after === "" ? null : after;
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

    if (selected.length) {
      await tx.productTranslation.update({
        where: { productId_locale: { productId: product.id, locale: "nl" } },
        data: translationData,
      });
    }
    for (const write of infoWrites) {
      await tx.productAttribute.upsert({
        where: { productId_key: { productId: product.id, key: write.key } },
        update: { value: write.after },
        create: { productId: product.id, key: write.key, value: write.after },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.adminUserId,
          action: "UPDATE",
          entityType: "ProductAttribute",
          entityId: product.id,
          before: { field: write.key, value: write.before },
          after: { field: write.key, value: write.after, source: persisted.fields[write.field].sourceStatus },
        },
      });
    }
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
        appliedFields: [...selected, ...infoWrites.map((write) => write.field)] as Prisma.InputJsonValue,
        appliedAt: new Date(),
      },
    });
    return { record: updated, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });

  // Serializable transactions can be aborted by a concurrent writer; retry a few times.
  let outcome: Awaited<ReturnType<typeof runApply>> | undefined;
  for (let attempt = 1; !outcome; attempt += 1) {
    try {
      outcome = await runApply();
    } catch (error) {
      if (!isSerializationFailure(error) || attempt >= 3) throw error;
    }
  }

  const product = await findProduct(database, outcome.record.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const current = sourceFromProduct(product);
  if (!outcome.replayed) {
    // The text is already saved; a failed cache refresh must not report the save as failed.
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/", "layout");
    } catch (error) {
      console.error("CopyWriter: storefront cache refresh after apply failed", error);
    }
  }
  return {
    proposal: copywriterProposalDto(proposalRecord(outcome.record), current, imageUrl(product), {
      acceptedFields: acceptedFieldsFor(product, current),
      latestProposal: latestProposalDto(outcome.record),
    }),
    replayed: outcome.replayed,
  };
}

/**
 * Records that an admin reviewed a field the CopyWriter flags for review and keeps
 * it as is. The acceptance expires automatically when the field text changes.
 */
export async function acceptCopywriterField(input: {
  adminUserId: string;
  productId: string;
  field: string;
}): Promise<{ product: CopywriterProductDto; proposal: CopywriterProposalDto | null }> {
  const { field } = copywriterAcceptFieldRequestSchema.parse({ field: input.field });
  const database = await copywriterPrisma();
  const product = await findProduct(database, input.productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const snapshot = sourceFromProduct(product);
  if (assessCopywriterCompleteness(snapshot).fields[field].status !== "NEEDS_REVIEW") {
    throw new CopywriterServiceError("FIELD_NOT_IN_REVIEW", `${copywriterFieldLabel(field)} hoeft niet gecontroleerd te worden.`, 409);
  }
  const valueHash = copywriterFieldValueHash(currentValue(snapshot, field));
  await database.productCopyFieldReview.upsert({
    where: { productId_locale_field: { productId: product.id, locale: "nl", field } },
    update: { valueHash, reviewedByAdminUserId: input.adminUserId, reviewedAt: new Date() },
    create: { productId: product.id, locale: "nl", field, valueHash, reviewedByAdminUserId: input.adminUserId },
  });
  return getCopywriterProduct({ adminUserId: input.adminUserId, productId: product.id });
}

/** The exact source snapshot the CopyWriter uses for a product (for tooling and tests). */
export async function copywriterSnapshotForProduct(productId: string): Promise<CopywriterSourceSnapshot> {
  const product = await findProduct(await copywriterPrisma(), productId);
  if (!product) throw new CopywriterServiceError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  return sourceFromProduct(product);
}

export function analyzeCopywriterSnapshot(snapshot: CopywriterSourceSnapshot) {
  return assessCopywriterCompleteness(snapshot);
}
