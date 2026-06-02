import { z } from "zod";

export const CreateVariantDtoSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  weightGrams: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  currency: z.literal("EUR"),
  stockQuantity: z.number().int().nonnegative(),
  lowStockAt: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
});

export type CreateVariantDto = z.infer<typeof CreateVariantDtoSchema>;
