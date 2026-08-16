import { z } from "zod";

// QrCodeDesign.targetType/status enums mirrored from prisma/schema.prisma.
export const qrCodeTargetTypes = [
  "product",
  "category",
  "discount",
  "whatsapp",
  "email",
  "wifi",
  "url",
  "text",
] as const;

export const qrCodeStatuses = ["active", "archived"] as const;

// targetConfig/designConfig/labelConfig are stored as Prisma Json columns —
// shape is enforced by the workbench UI, not the database, so we only check
// that they are plain JSON objects here and let the client own the fields.
// The 10KB cap guards against an oversized/malformed payload bloating the
// row — legitimate configs (a handful of strings/numbers) are a few hundred
// bytes at most.
const MAX_JSON_CONFIG_BYTES = 10_000;

const jsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= MAX_JSON_CONFIG_BYTES, {
    message: `Configuratie mag niet groter zijn dan ${MAX_JSON_CONFIG_BYTES} bytes`,
  });

export const qrCodeInputSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht").max(200),
  status: z.enum(qrCodeStatuses).optional(),
  targetType: z.enum(qrCodeTargetTypes),
  targetConfig: jsonObjectSchema,
  designConfig: jsonObjectSchema,
  labelConfig: jsonObjectSchema,
});

export type QrCodeInput = z.infer<typeof qrCodeInputSchema>;
