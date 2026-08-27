import { z } from "zod";

export const photoRoomBackgrounds = ["transparent", "white", "brand", "custom"] as const;
export const photoRoomFormats = ["square", "portrait"] as const;
export const photoRoomPaddings = [0.05, 0.1, 0.15, 0.2] as const;

export const photoRoomJobSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  imageId: z.string().trim().min(1).max(100),
  background: z.enum(photoRoomBackgrounds),
  customColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  format: z.enum(photoRoomFormats),
  padding: z.number().refine((value) => photoRoomPaddings.includes(value as (typeof photoRoomPaddings)[number])),
  softShadow: z.boolean(),
}).superRefine((value, context) => {
  if (value.background === "custom" && !value.customColor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customColor"], message: "Kies een geldige achtergrondkleur." });
  }
});

export type PhotoRoomJobInput = z.infer<typeof photoRoomJobSchema>;
