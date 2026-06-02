import { type z } from "zod";
import { CreateVariantDtoSchema } from "./create-variant.dto";

export const UpdateVariantDtoSchema = CreateVariantDtoSchema.partial();
export type UpdateVariantDto = z.infer<typeof UpdateVariantDtoSchema>;
