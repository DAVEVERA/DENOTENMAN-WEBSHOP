import { z } from "zod";

const UuidSchema = z.string().uuid();

/**
 * Schema for a single line-item in a checkout session request.
 * Price and currency are resolved server-side from the DB — client only
 * supplies product/variant identity and quantity.
 */
export const CheckoutLineItemSchema = z.object({
  variantId: UuidSchema,
  quantity: z.number().int().min(1).max(999),
});

export type CheckoutLineItem = z.infer<typeof CheckoutLineItemSchema>;

/**
 * Request body schema for POST /v1/stripe/checkout.
 * `successUrl` and `cancelUrl` are caller-supplied redirect URLs.
 * They must start with the configured storefront origin to prevent
 * open-redirect abuse — validation happens in StripeService.
 */
export const CreateCheckoutSessionSchema = z.object({
  cartId: UuidSchema,
  lineItems: z.array(CheckoutLineItemSchema).min(1).max(50),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateCheckoutSessionDto = z.infer<typeof CreateCheckoutSessionSchema>;

/**
 * Response body for POST /v1/stripe/checkout.
 */
export const CheckoutSessionResponseSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
});

export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;
