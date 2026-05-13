import { z } from "zod";

export const CreateCategoryDtoSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type CreateCategoryDto = z.infer<typeof CreateCategoryDtoSchema>;
