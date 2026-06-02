import { z } from "zod";

export const UpdateOrderStatusDtoSchema = z.object({
  status: z.enum(["pending", "paid", "fulfilled", "cancelled", "refunded"]),
});

export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusDtoSchema>;
