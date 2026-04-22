import { z } from "zod";
import { IdSchema, MoneyCentsSchema } from "./common.js";
import { ShippingCountrySchema } from "./order.js";

export const ShippingRuleSchema = z.object({
  id: IdSchema,
  country: ShippingCountrySchema,
  name: z.string().min(1),
  baseCostCents: MoneyCentsSchema,
  freeAboveCents: MoneyCentsSchema.nullable(),
  estimatedDays: z.number().int().positive(),
  active: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ShippingRule = z.infer<typeof ShippingRuleSchema>;

export const ShippingQuoteSchema = z.object({
  ruleId: IdSchema,
  name: z.string().min(1),
  costCents: MoneyCentsSchema,
  estimatedDays: z.number().int().positive(),
  isFree: z.boolean(),
});
export type ShippingQuote = z.infer<typeof ShippingQuoteSchema>;
