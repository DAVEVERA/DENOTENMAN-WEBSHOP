import type { NextRequest } from "next/server";

import { createPromotion, promotionJson, requirePromotionAdmin } from "@/lib/promotions/admin";
import { promotionInputSchema } from "@/lib/promotions/schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await requirePromotionAdmin(request, { write: true });
  if (guard.response) return guard.response;
  const parsed = promotionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return promotionJson({ error: "VALIDATION_ERROR", field: issue?.path.join(".") ?? null, message: issue?.message ?? "Controleer de actie." }, 422);
  }
  const promotion = await createPromotion(guard.admin, parsed.data);
  return promotionJson({ promotion: { id: promotion.id } }, 201);
}
