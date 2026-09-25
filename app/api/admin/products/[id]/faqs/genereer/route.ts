import { NextResponse, type NextRequest } from "next/server";
import { authorizeFaqRequest } from "@/lib/product-faq-api";
import { getAdminProductFaqSet } from "@/lib/product-faq";
import { generateProductFaqSuggestions, isProductFaqAiConfigured, ProductFaqAiError } from "@/lib/product-faq-ai";
import { loadProductFaqFactCard } from "@/lib/product-faq-ai-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authorizeFaqRequest(request, true);
  if (admin instanceof NextResponse) return admin;
  if (!isProductFaqAiConfigured()) {
    return NextResponse.json({ error: "FAQ_AI_NOT_CONFIGURED" }, { status: 503 });
  }
  const { id } = await params;
  try {
    const [factCard, faqSet] = await Promise.all([loadProductFaqFactCard(id), getAdminProductFaqSet(id)]);
    const existingQuestions = faqSet.items.flatMap((item) =>
      [item.draft, item.published].flatMap((revision) =>
        revision?.translations.filter((translation) => translation.locale === "nl").map((translation) => translation.question) ?? []
      )
    );
    const suggestions = await generateProductFaqSuggestions({ factCard, existingQuestions });
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProductFaqAiError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    console.error("Product FAQ AI generation failed", error);
    return NextResponse.json({ error: "FAQ_AI_GENERATION_FAILED" }, { status: 500 });
  }
}
