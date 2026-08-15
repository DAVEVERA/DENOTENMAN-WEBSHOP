import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { buildProductAudit, generateProductAuditProposals } from "@/lib/product-audit";
import { ProductAuditOpenAIError } from "@/lib/product-audit-openai";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const audit = await buildProductAudit(id);
  if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ audit });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ proposalSet: await generateProductAuditProposals(id) });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (error instanceof Error && error.message === "OPENAI_UNGROUNDED_CLAIM") {
      return NextResponse.json(
        { error: "OPENAI_UNGROUNDED_CLAIM", message: "De AI-tekst bevatte na een veilige herkansing nog een onbewezen productclaim. Er is niets opgeslagen; probeer de audit opnieuw." },
        { status: 422 }
      );
    }
    if (error instanceof ProductAuditOpenAIError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.code === "OPENAI_API_KEY_MISSING"
            ? "OPENAI_API_KEY ontbreekt; voeg de sleutel toe voordat je AI-voorstellen genereert."
            : error.code === "OPENAI_CREDITS_EXHAUSTED"
              ? "Het OpenAI-project heeft geen API-tegoed. Voeg tegoed toe of koppel een projectsleutel met beschikbaar budget."
            : error.code === "OPENAI_RATE_LIMITED"
              ? "OpenAI is tijdelijk te druk. Probeer het straks opnieuw."
              : "OpenAI kon geen geldig gestructureerd voorstel leveren.",
        },
        { status: error.status }
      );
    }
    console.error(`AI product audit failed for ${id}`, error);
    return NextResponse.json({ error: "AUDIT_FAILED", message: "De AI-audit kon niet veilig worden afgerond." }, { status: 502 });
  }
}
