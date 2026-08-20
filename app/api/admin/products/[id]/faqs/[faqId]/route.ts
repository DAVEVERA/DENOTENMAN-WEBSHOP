import { NextResponse, type NextRequest } from "next/server";
import { authorizeFaqRequest, faqErrorResponse, parseJson } from "@/lib/product-faq-api";
import { deleteFaqItem, saveFaqDraft } from "@/lib/product-faq-db";
import { faqActionInputSchema, faqDraftInputSchema } from "@/lib/product-faq-schema";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { revalidateProductFaq } from "@/lib/product-faq-revalidation";

type Context = { params: Promise<{ id: string; faqId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request); if (body instanceof NextResponse) return body;
  const parsed = faqDraftInputSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id, faqId } = await params;
  try { await saveFaqDraft(id, faqId, admin, parsed.data); revalidateProductFaq(id); return NextResponse.json(await getAdminProductFaqSet(id)); } catch (error) { return faqErrorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const admin = await authorizeFaqRequest(request, true); if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request); if (body instanceof NextResponse) return body;
  const parsed = faqActionInputSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id, faqId } = await params;
  try { await deleteFaqItem(id, faqId, admin, parsed.data); revalidateProductFaq(id); return NextResponse.json(await getAdminProductFaqSet(id)); } catch (error) { return faqErrorResponse(error); }
}
