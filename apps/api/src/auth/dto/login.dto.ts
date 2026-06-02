import { z } from "zod";

// Duplicated from @denotenman/schemas to avoid the dual-zod-version type
// collision that arises when re-exporting schemas across workspace boundaries.
// The shape is identical to LoginSchema in packages/schemas/src/auth.ts.
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof LoginSchema>;
