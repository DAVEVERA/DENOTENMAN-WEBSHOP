import { z } from "zod";
import { IdSchema, MoneyCentsSchema } from "./common.js";

export const OrderStatusSchema = z.enum(["pending", "paid", "fulfilled", "cancelled", "refunded"]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ShippingCountrySchema = z.enum(["NL", "BE"]);
export type ShippingCountry = z.infer<typeof ShippingCountrySchema>;

export const AddressSchema = z.object({
  id: IdSchema,
  customerId: IdSchema,
  label: z.string().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().nullable(),
  street: z.string().min(1),
  houseNumber: z.string().min(1),
  addition: z.string().nullable(),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: ShippingCountrySchema,
  phoneNumber: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Address = z.infer<typeof AddressSchema>;

export const OrderLineSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  productId: IdSchema,
  variantId: IdSchema,
  productName: z.string().min(1),
  variantName: z.string().min(1),
  unitPriceCents: MoneyCentsSchema,
  quantity: z.number().int().positive(),
  totalCents: MoneyCentsSchema,
  createdAt: z.coerce.date(),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const OrderSchema = z.object({
  id: IdSchema,
  orderNumber: z.string().min(1),
  customerId: IdSchema.nullable(),
  guestEmail: z.string().email().nullable(),
  status: OrderStatusSchema,
  currency: z.string().length(3),
  subtotalCents: MoneyCentsSchema,
  shippingCents: MoneyCentsSchema,
  taxCents: MoneyCentsSchema,
  totalCents: MoneyCentsSchema,
  shippingAddressId: IdSchema.nullable(),
  billingAddressId: IdSchema.nullable(),
  stripeSessionId: z.string().nullable(),
  stripePaymentIntent: z.string().nullable(),
  paidAt: z.coerce.date().nullable(),
  fulfilledAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lines: z.array(OrderLineSchema),
});
export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = z.object({
  customerId: IdSchema.optional(),
  guestEmail: z.string().email().optional(),
  shippingAddressId: IdSchema,
  billingAddressId: IdSchema.optional(),
  notes: z.string().optional(),
});
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
