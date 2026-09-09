import { createHash } from "node:crypto";
import { z } from "zod";

import { slugify } from "../../slugify";
import {
  normalizeCopywriterHtml,
  normalizeCopywriterText,
} from "./schema";

const nullableSourceTextSchema = z.string().nullable().optional();

export const copywriterSourceInputSchema = z.object({
  product: z.object({
    id: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    slug: z.string(),
    updatedAt: z.union([z.string().datetime(), z.date()]),
    basePriceCents: z.number().int().nonnegative(),
    salePriceCents: z.number().int().nonnegative().nullable(),
    currency: z.string().trim().min(1).max(8),
    unit: z.string().trim().min(1).max(40),
    isActive: z.boolean(),
  }).strict(),
  translation: z.object({
    locale: z.literal("nl"),
    name: z.string(),
    slug: z.string(),
    shortDescription: nullableSourceTextSchema,
    shortDescriptionHtml: nullableSourceTextSchema,
    description: nullableSourceTextSchema,
    descriptionHtml: nullableSourceTextSchema,
    seoTitle: nullableSourceTextSchema,
    metaDescription: nullableSourceTextSchema,
    promotionText: nullableSourceTextSchema,
  }).strict(),
  attributes: z.array(z.object({
    key: z.string().trim().min(1).max(120),
    value: z.string().max(100_000),
  }).strict()).max(500),
  categories: z.array(z.object({
    id: z.string().trim().min(1),
    slug: z.string(),
    name: z.string(),
    parentId: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }).strict()).max(100),
  variants: z.array(z.object({
    id: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    weightGrams: z.number().int().positive(),
    preparation: z.string().trim().min(1).max(80),
    salting: z.string().trim().min(1).max(80),
    coating: z.string().trim().min(1).max(80),
    priceCents: z.number().int().nonnegative().optional(),
    salePriceCents: z.number().int().nonnegative().nullable().optional(),
    stock: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  }).strict()).max(250),
}).strict().superRefine((value, context) => {
  const categoryIds = value.categories.map(({ id }) => id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categories"],
      message: "Categorie-ID's moeten binnen het bronsnapshot uniek zijn.",
    });
  }
  const variantIds = value.variants.map(({ id }) => id);
  if (new Set(variantIds).size !== variantIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variants"],
      message: "Variant-ID's moeten binnen het bronsnapshot uniek zijn.",
    });
  }
});

export type CopywriterSourceInput = z.input<typeof copywriterSourceInputSchema>;

export type CopywriterSourceSnapshot = {
  schemaVersion: 1;
  locale: "nl";
  product: {
    id: string;
    sku: string;
    slug: string;
    updatedAt: string;
    basePriceCents: number;
    salePriceCents: number | null;
    currency: string;
    unit: string;
    isActive: boolean;
  };
  translation: {
    name: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    descriptionHtml: string | null;
    seoTitle: string | null;
    metaDescription: string | null;
    promotionText: string | null;
  };
  facts: {
    ingredients: string | null;
    allergens: string | null;
    mayContainTraces: string | null;
  };
  attributes: Array<{ key: string; value: string }>;
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    parentId: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    weightGrams: number;
    preparation: string;
    salting: string;
    coating: string;
    priceCents: number | null;
    salePriceCents: number | null;
    stock: number | null;
    isActive: boolean;
  }>;
};

export const copywriterSourceSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  locale: z.literal("nl"),
  product: z.object({
    id: z.string().min(1),
    sku: z.string().min(1),
    slug: z.string(),
    updatedAt: z.string().datetime(),
    basePriceCents: z.number().int().nonnegative(),
    salePriceCents: z.number().int().nonnegative().nullable(),
    currency: z.string().min(1).max(8),
    unit: z.string().min(1).max(40),
    isActive: z.boolean(),
  }).strict(),
  translation: z.object({
    name: z.string(),
    slug: z.string(),
    shortDescription: z.string().nullable(),
    description: z.string().nullable(),
    descriptionHtml: z.string().nullable(),
    seoTitle: z.string().nullable(),
    metaDescription: z.string().nullable(),
    promotionText: z.string().nullable(),
  }).strict(),
  facts: z.object({
    ingredients: z.string().nullable(),
    allergens: z.string().nullable(),
    mayContainTraces: z.string().nullable(),
  }).strict(),
  attributes: z.array(z.object({
    key: z.string().min(1).max(120),
    value: z.string().max(100_000),
  }).strict()).max(500),
  categories: z.array(z.object({
    id: z.string().min(1),
    slug: z.string(),
    name: z.string(),
    parentId: z.string().nullable(),
    isPrimary: z.boolean(),
    sortOrder: z.number().int(),
  }).strict()).max(100),
  variants: z.array(z.object({
    id: z.string().min(1),
    sku: z.string().min(1),
    weightGrams: z.number().int().positive(),
    preparation: z.string().min(1).max(80),
    salting: z.string().min(1).max(80),
    coating: z.string().min(1).max(80),
    priceCents: z.number().int().nonnegative().nullable(),
    salePriceCents: z.number().int().nonnegative().nullable(),
    stock: z.number().int().nonnegative().nullable(),
    isActive: z.boolean(),
  }).strict()).max(250),
}).strict().superRefine((value, context) => {
  const categoryIds = value.categories.map(({ id }) => id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categories"],
      message: "Categorie-ID's moeten binnen het bronsnapshot uniek zijn.",
    });
  }
  const variantIds = value.variants.map(({ id }) => id);
  if (new Set(variantIds).size !== variantIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variants"],
      message: "Variant-ID's moeten binnen het bronsnapshot uniek zijn.",
    });
  }
});

function nullableNormalizedText(value: string | null | undefined): string | null {
  const normalized = normalizeCopywriterText(value);
  return normalized || null;
}

function exactSourceText(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFC").trim() ?? "";
  return normalized || null;
}

export function buildCopywriterSourceSnapshot(input: CopywriterSourceInput): CopywriterSourceSnapshot {
  const parsed = copywriterSourceInputSchema.parse(input);
  const attributes = parsed.attributes
    .map(({ key, value }) => ({ key, value: value.normalize("NFC").trim() }))
    .sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value));
  const attributeMap = new Map(attributes.map(({ key, value }) => [key, value]));
  const descriptionHtml = normalizeCopywriterHtml(
    parsed.translation.descriptionHtml ?? parsed.translation.description
  );
  const description = normalizeCopywriterText(descriptionHtml);

  const snapshot: CopywriterSourceSnapshot = {
    schemaVersion: 1,
    locale: "nl",
    product: {
      ...parsed.product,
      sku: parsed.product.sku.normalize("NFC"),
      slug: parsed.product.slug.normalize("NFC").trim(),
      updatedAt: parsed.product.updatedAt instanceof Date
        ? parsed.product.updatedAt.toISOString()
        : new Date(parsed.product.updatedAt).toISOString(),
    },
    translation: {
      name: normalizeCopywriterText(parsed.translation.name),
      slug: parsed.translation.slug.trim(),
      shortDescription: nullableNormalizedText(
        parsed.translation.shortDescriptionHtml ?? parsed.translation.shortDescription
      ),
      description: description || null,
      descriptionHtml: description ? descriptionHtml : null,
      seoTitle: nullableNormalizedText(parsed.translation.seoTitle),
      metaDescription: nullableNormalizedText(parsed.translation.metaDescription),
      promotionText: nullableNormalizedText(parsed.translation.promotionText),
    },
    facts: {
      ingredients: exactSourceText(attributeMap.get("ingredients")),
      allergens: exactSourceText(attributeMap.get("allergens")),
      mayContainTraces: exactSourceText(attributeMap.get("mayContainTraces")),
    },
    attributes,
    categories: parsed.categories
      .map((category) => ({
        id: category.id,
        slug: category.slug.normalize("NFC").trim(),
        name: normalizeCopywriterText(category.name),
        parentId: category.parentId ?? null,
        isPrimary: category.isPrimary ?? false,
        sortOrder: category.sortOrder ?? 0,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    variants: parsed.variants
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku.normalize("NFC"),
        weightGrams: variant.weightGrams,
        preparation: variant.preparation,
        salting: variant.salting,
        coating: variant.coating,
        priceCents: variant.priceCents ?? null,
        salePriceCents: variant.salePriceCents ?? null,
        stock: variant.stock ?? null,
        isActive: variant.isActive ?? true,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return copywriterSourceSnapshotSchema.parse(snapshot);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function canonicalSourceHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalStringify(value)).digest("hex")}`;
}

export function protectedFactsHash(snapshot: CopywriterSourceSnapshot): string {
  return canonicalSourceHash({
    product: {
      id: snapshot.product.id,
      sku: snapshot.product.sku,
      basePriceCents: snapshot.product.basePriceCents,
      salePriceCents: snapshot.product.salePriceCents,
      currency: snapshot.product.currency,
      unit: snapshot.product.unit,
      isActive: snapshot.product.isActive,
    },
    facts: snapshot.facts,
    attributes: snapshot.attributes,
    categories: snapshot.categories,
    variants: snapshot.variants,
  });
}

export function deterministicProductSlug(name: string, fallback = "product"): string {
  const fromName = slugify(name, 160);
  if (fromName.length >= 2) return fromName;
  const fromFallback = slugify(fallback, 160);
  return fromFallback.length >= 2 ? fromFallback : "product";
}

export const hashCopywriterSource = canonicalSourceHash;
export const hashCopywriterProtectedFacts = protectedFactsHash;
export const createDeterministicProductSlug = deterministicProductSlug;
