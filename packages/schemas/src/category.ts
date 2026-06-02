import { z } from "zod";
import { IdSchema, SlugSchema } from "./common";

// Shared base: fields present on every category row returned by the API.
const CategoryBaseSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  parentId: IdSchema.nullable(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});

// GET /v1/categories → CategoryTree[]
// Children carry the same base fields plus a productCount.
export const CategoryTreeChildSchema = CategoryBaseSchema.extend({
  productCount: z.number().int().nonnegative(),
});
export type CategoryTreeChild = z.infer<typeof CategoryTreeChildSchema>;

export const CategoryTreeSchema = CategoryBaseSchema.extend({
  productCount: z.number().int().nonnegative(),
  children: z.array(CategoryTreeChildSchema),
});
export type CategoryTree = z.infer<typeof CategoryTreeSchema>;

// GET /v1/categories/:slug → CategoryDetail
// parent is a partial select: { id, slug, name } — no timestamps, no parentId.
const CategoryDetailParentSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  name: z.string().min(1),
});
export type CategoryDetailParent = z.infer<typeof CategoryDetailParentSchema>;

// Children returned by findBySlug are flat category rows (no nesting, no productCount).
export const CategoryDetailChildSchema = CategoryBaseSchema;
export type CategoryDetailChild = z.infer<typeof CategoryDetailChildSchema>;

export const CategoryDetailSchema = CategoryBaseSchema.extend({
  parent: CategoryDetailParentSchema.nullable(),
  children: z.array(CategoryDetailChildSchema),
});
export type CategoryDetail = z.infer<typeof CategoryDetailSchema>;
