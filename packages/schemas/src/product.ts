import { z } from "zod";
import { IdSchema, SlugSchema, MoneyCentsSchema } from "./common.js";

export const ProductStatusSchema = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const CategorySchema = z.object({
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
export type Category = z.infer<typeof CategorySchema>;

export const TagSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  name: z.string().min(1),
  createdAt: z.coerce.date(),
});
export type Tag = z.infer<typeof TagSchema>;

export const ProductVariantSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  weightGrams: z.number().int().positive(),
  priceCents: MoneyCentsSchema,
  currency: z.string().length(3),
  stockQuantity: z.number().int().nonnegative(),
  lowStockAt: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductImageSchema = z.object({
  id: IdSchema,
  productId: IdSchema,
  url: z.string().url(),
  altText: z.string(),
  position: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.coerce.date(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  id: IdSchema,
  sku: z.string().min(1),
  slug: SlugSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  categoryId: IdSchema,
  status: ProductStatusSchema,
  origin: z.string().nullable(),
  harvestYear: z.number().int().positive().nullable(),
  roasted: z.boolean().nullable(),
  organic: z.boolean(),
  allergens: z.array(z.string()),
  ingredients: z.string().nullable(),
  storageInfo: z.string().nullable(),
  tasteNotes: z.string().nullable(),
  usageTip: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  variants: z.array(ProductVariantSchema),
  images: z.array(ProductImageSchema),
  tags: z.array(TagSchema),
  category: CategorySchema,
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductCreateSchema = ProductSchema.pick({
  sku: true,
  slug: true,
  name: true,
  description: true,
  categoryId: true,
  status: true,
  origin: true,
  harvestYear: true,
  roasted: true,
  organic: true,
  allergens: true,
  ingredients: true,
  storageInfo: true,
  tasteNotes: true,
  usageTip: true,
});
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = ProductCreateSchema.partial();
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
