import { NextResponse, type NextRequest } from "next/server";
import { authorizeFaqRequest, faqErrorResponse, parseJson } from "@/lib/product-faq-api";
import { reorderFaqItems } from "@/lib/product-faq-db";
import { faqReorderInputSchema } from "@/lib/product-faq-schema";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { revalidateProductFaq } from "@/lib/product-faq-revalidation";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request); if (body instanceof NextResponse) return body;
  const parsed = faqReorderInputSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id } = await params;
  try { await reorderFaqItems(id, admin, parsed.data); revalidateProductFaq(id); return NextResponse.json(await getAdminProductFaqSet(id)); } catch (error) { return faqErrorResponse(error); }
}
