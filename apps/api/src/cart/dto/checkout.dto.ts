import { z } from "zod";

export const CheckoutBodySchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;

export const CheckoutResponseSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().url(),
  orderId: z.string().uuid(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
