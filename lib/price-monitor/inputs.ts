import { z } from "zod";

export const priceMonitorRunInputSchema = z.object({
  sourceKey: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const priceMonitorMatchReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

export const priceMonitorApplySchema = z.object({
  expectedCurrentPriceCents: z.number().int().min(1),
  targetPriceCents: z.number().int().min(50).max(100_000),
  marginChecked: z.literal(true),
});

export const priceMonitorScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    hourLocal: z.number().int().min(0).max(23),
    dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
    recipientEmail: z.union([z.string().trim().email().max(254), z.literal("")]),
    formats: z.array(z.enum(["CSV", "JSON", "PRINT"])).min(1).max(3),
    minDifferencePercent: z.number().min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.enabled && !value.recipientEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientEmail"],
        message: "Vul een ontvanger in voordat je automatische rapporten aanzet.",
      });
    }
    if (value.frequency === "WEEKLY" && !value.dayOfWeek) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfWeek"],
        message: "Kies een weekdag.",
      });
    }
    if (value.frequency === "MONTHLY" && !value.dayOfMonth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfMonth"],
        message: "Kies een dag van de maand.",
      });
    }
  });
