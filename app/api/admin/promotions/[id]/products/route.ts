import type { NextRequest } from "next/server";
import { z } from "zod";

import { promotionJson, requirePromotionAdmin, setPromotionProduct } from "@/lib/promotions/admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const inputSchema = z.object({ productId: z.string().min(1).max(40), included: z.boolean() }).strict();

// The checkbox on a product's admin page: in or out of this promotion.
export async function POST(request: NextRequest, context: Context) {
  const guard = await requirePromotionAdmin(request, { write: true });
  if (guard.response) return guard.response;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return promotionJson({ error: "INVALID_INPUT", message: "Ongeldige invoer." }, 422);
  const promotion = await setPromotionProduct(guard.admin, (await context.params).id, parsed.data.productId, parsed.data.included);
  if (!promotion) return promotionJson({ error: "NOT_FOUND", message: "Deze actie bestaat niet meer." }, 404);
  return promotionJson({ ok: true });
}
