import type { NextRequest } from "next/server";

import { deletePromotion, promotionJson, requirePromotionAdmin, updatePromotion } from "@/lib/promotions/admin";
import { promotionInputSchema } from "@/lib/promotions/schema";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const guard = await requirePromotionAdmin(request, { write: true });
  if (guard.response) return guard.response;
  const parsed = promotionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return promotionJson({ error: "VALIDATION_ERROR", field: issue?.path.join(".") ?? null, message: issue?.message ?? "Controleer de actie." }, 422);
  }
  const promotion = await updatePromotion(guard.admin, (await context.params).id, parsed.data);
  if (!promotion) return promotionJson({ error: "NOT_FOUND", message: "Deze actie bestaat niet meer." }, 404);
  return promotionJson({ promotion: { id: promotion.id } });
}

export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requirePromotionAdmin(request, { write: true });
  if (guard.response) return guard.response;
  const deleted = await deletePromotion(guard.admin, (await context.params).id);
  if (!deleted) return promotionJson({ error: "NOT_FOUND", message: "Deze actie bestaat niet meer." }, 404);
  return promotionJson({ ok: true });
}
