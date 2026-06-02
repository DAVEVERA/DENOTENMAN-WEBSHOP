import { type z } from "zod";
import { CreateCategoryDtoSchema } from "./create-category.dto";

export const UpdateCategoryDtoSchema = CreateCategoryDtoSchema.partial();
export type UpdateCategoryDto = z.infer<typeof UpdateCategoryDtoSchema>;
