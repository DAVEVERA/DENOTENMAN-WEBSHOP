import { z } from "zod";

export const COST_PROVIDERS = ["PHOTOROOM", "PRISMA", "OTHER"] as const;
export const COST_CATEGORIES = [
  "SOFTWARE",
  "INFRASTRUCTURE",
  "MARKETING",
  "OTHER",
] as const;
export const COST_RECURRENCES = ["ONE_TIME", "MONTHLY", "YEARLY"] as const;

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((value) =>
    value ? new Date(value) : value === null ? null : undefined,
  );

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);
const amountCents = z.number().int().nonnegative().max(1_000_000_000);

const managedCostFields = z.object({
  provider: z.enum(COST_PROVIDERS),
  providerName: z.string().trim().min(1).max(120),
  category: z.enum(COST_CATEGORIES),
  description: z.string().trim().max(500).nullable().optional(),
  amountCents: amountCents.nullable(),
  currency: currency.default("EUR"),
  recurrence: z.enum(COST_RECURRENCES),
  startsAt: optionalDate,
  endsAt: optionalDate,
  active: z.boolean().default(true),
});

export const managedCostCreateSchema = managedCostFields.superRefine(
  (value, context) => {
    if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "ENDS_BEFORE_START",
      });
    }
  },
);

export const managedCostUpdateSchema = managedCostFields
  .omit({
    provider: true,
    providerName: true,
    category: true,
    amountCents: true,
    recurrence: true,
  })
  .extend({
    expectedVersion: z.number().int().positive(),
    provider: z.enum(COST_PROVIDERS).optional(),
    providerName: z.string().trim().min(1).max(120).optional(),
    category: z.enum(COST_CATEGORIES).optional(),
    amountCents: amountCents.nullable().optional(),
    currency: currency.optional(),
    recurrence: z.enum(COST_RECURRENCES).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "ENDS_BEFORE_START",
      });
    }
  });

export const deleteCostSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const invoiceMetadataSchema = z
  .object({
    managedCostId: z.string().uuid().nullable().optional(),
    provider: z.enum(COST_PROVIDERS).nullable().optional(),
    category: z.enum(COST_CATEGORIES).nullable().optional(),
    amountCents: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(1_000_000_000)
      .nullable()
      .optional(),
    currency: currency.default("EUR"),
    issuedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    billingPeriodStart: optionalDate,
    billingPeriodEnd: optionalDate,
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.billingPeriodStart &&
      value.billingPeriodEnd &&
      value.billingPeriodEnd < value.billingPeriodStart
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billingPeriodEnd"],
        message: "BILLING_PERIOD_INVALID",
      });
    }
  });

export function parseInvoiceMetadata(form: FormData) {
  return invoiceMetadataSchema.safeParse({
    managedCostId: optionalFormValue(form, "managedCostId"),
    provider: optionalFormValue(form, "provider"),
    category: optionalFormValue(form, "category"),
    amountCents: optionalFormValue(form, "amountCents"),
    currency: optionalFormValue(form, "currency") ?? "EUR",
    issuedAt: form.get("issuedAt"),
    billingPeriodStart: optionalFormValue(form, "billingPeriodStart"),
    billingPeriodEnd: optionalFormValue(form, "billingPeriodEnd"),
    notes: optionalFormValue(form, "notes"),
  });
}

function optionalFormValue(
  form: FormData,
  key: string,
): FormDataEntryValue | null | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export function parseListLimit(
  value: string | null,
  fallback = 50,
  maximum = 100,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

export function isValidIdempotencyKey(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9:_-]{8,100}$/.test(value));
}

export type ManagedCostCreateInput = z.infer<typeof managedCostCreateSchema>;
export type ManagedCostUpdateInput = z.infer<typeof managedCostUpdateSchema>;
export type InvoiceMetadataInput = z.infer<typeof invoiceMetadataSchema>;
