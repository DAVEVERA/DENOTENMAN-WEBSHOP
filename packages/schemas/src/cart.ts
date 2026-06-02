import { z } from "zod";
import { IdSchema } from "./common.js";

export const CartLineSchema = z.object({
  id: IdSchema,
  cartId: IdSchema,
  productId: IdSchema,
  variantId: IdSchema,
  quantity: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CartLine = z.infer<typeof CartLineSchema>;

export const CartSchema = z.object({
  id: IdSchema,
  customerId: IdSchema.nullable(),
  token: z.string().min(1),
  currency: z.string().length(3),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lines: z.array(CartLineSchema),
});
export type Cart = z.infer<typeof CartSchema>;

export const AddToCartSchema = z.object({
  variantId: IdSchema,
  quantity: z.number().int().positive(),
});
export type AddToCart = z.infer<typeof AddToCartSchema>;

export const UpdateCartLineSchema = z.object({
  quantity: z.number().int().positive(),
});
export type UpdateCartLine = z.infer<typeof UpdateCartLineSchema>;
