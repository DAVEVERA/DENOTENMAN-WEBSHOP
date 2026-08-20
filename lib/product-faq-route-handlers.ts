import { NextResponse, type NextRequest } from "next/server";
import type { ProductFaqStatus } from "@prisma/client";
import { authorizeFaqRequest, faqErrorResponse, parseJson } from "@/lib/product-faq-api";
import { changeFaqStatus } from "@/lib/product-faq-db";
import { faqActionInputSchema } from "@/lib/product-faq-schema";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { revalidateProductFaq } from "@/lib/product-faq-revalidation";

export async function handleFaqStatus(
  request: NextRequest,
  params: Promise<{ id: string; faqId: string }>,
  status: ProductFaqStatus,
) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request); if (body instanceof NextResponse) return body;
  const parsed = faqActionInputSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id, faqId } = await params;
  try { await changeFaqStatus(id, faqId, admin, parsed.data, status); revalidateProductFaq(id); return NextResponse.json(await getAdminProductFaqSet(id)); } catch (error) { return faqErrorResponse(error); }
}
