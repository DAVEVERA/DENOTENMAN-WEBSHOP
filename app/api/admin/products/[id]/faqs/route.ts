import { NextResponse, type NextRequest } from "next/server";
import { faqCreateInputSchema } from "@/lib/product-faq-schema";
import { authorizeFaqRequest, faqErrorResponse, parseJson } from "@/lib/product-faq-api";
import { createFaqItem } from "@/lib/product-faq-db";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { revalidateProductFaq } from "@/lib/product-faq-revalidation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeFaqRequest(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  return NextResponse.json(await getAdminProductFaqSet(id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeFaqRequest(request, true);
  if (admin instanceof NextResponse) return admin;
  const body = await parseJson(request);
  if (body instanceof NextResponse) return body;
  const parsed = faqCreateInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
  const { id } = await params;
  try {
    const itemId = await createFaqItem(id, admin, parsed.data);
    revalidateProductFaq(id);
    return NextResponse.json({ ...(await getAdminProductFaqSet(id)), itemId }, { status: 201 });
  } catch (error) { return faqErrorResponse(error); }
}
