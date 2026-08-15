import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { generateProductAuditAdvice } from "@/lib/product-audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ advice: await generateProductAuditAdvice(id) });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    console.error(`AI product audit failed for ${id}`, error);
    return NextResponse.json({ error: "AUDIT_FAILED" }, { status: 500 });
  }
}
