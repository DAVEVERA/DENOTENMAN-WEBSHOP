import { z } from "zod";

export const ListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.string().optional(),
});
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
