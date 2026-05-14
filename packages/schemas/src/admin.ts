import { z } from "zod";
import { MoneyCentsSchema } from "./common.js";

export const AdminStatsSchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  pendingOrders: z.number().int().nonnegative(),
  paidOrders: z.number().int().nonnegative(),
  fulfilledOrders: z.number().int().nonnegative(),
  revenueThisMonth: MoneyCentsSchema,
  totalProducts: z.number().int().nonnegative(),
  activeProducts: z.number().int().nonnegative(),
  totalCategories: z.number().int().nonnegative(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;
